// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  rate: { allowed: true, retryAfter: 0 },
  orders: { data: [] as { id: string }[] | null, error: null as { message: string } | null },
  recent: { count: 0 as number | null },
  inserted: { data: { id: "w-1", received_at: "2026-10-04T23:11:23.000Z" } as unknown, error: null as { message: string } | null },
  ordersIlike: vi.fn(),
  recentIlike: vi.fn(),
  insert: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  getClientIp: () => "203.0.113.7",
  checkFormRateLimit: async () => m.rate,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "orders"
        ? {
            select: () => ({
              in: () => ({
                ilike: (col: string, pattern: string) => {
                  m.ordersIlike(col, pattern);
                  return { order: () => ({ limit: async () => m.orders }) };
                },
              }),
            }),
          }
        : {
            // Comptage des déclarations récentes de la même adresse.
            select: () => ({
              ilike: (col: string, pattern: string) => {
                m.recentIlike(col, pattern);
                return { gte: async () => m.recent };
              },
            }),
            insert: (row: unknown) => {
              m.insert(row);
              return { select: () => ({ single: async () => m.inserted }) };
            },
          },
  }),
}));
vi.mock("@/lib/withdrawal-server", async (orig) => ({
  ...(await orig<typeof import("@/lib/withdrawal-server")>()),
  finishWithdrawalAfterResponse: m.finish,
}));
vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: vi.fn() }));

import { POST } from "@/app/api/boutique/retractation/route";
import { FIELD_MAX } from "@/lib/limits";
import { MAX_ACK_ATTEMPTS, MAX_ACK_PER_EMAIL_PER_DAY } from "@/lib/withdrawal-server";

const ORDER = "1a2b3c4d-0000-4000-8000-000000000001";
const OTHER = "ffeeddcc-0000-4000-8000-000000000002";
const good = {
  nom: "Jeanne Martin",
  email: "jeanne@exemple.fr",
  commande: "",
  details: "",
  website: "",
  elapsed: "9000",
  locale: "fr",
};

const call = (body: unknown = good, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://xbz.test/api/boutique/retractation", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  m.rate = { allowed: true, retryAfter: 0 };
  m.orders = { data: [{ id: ORDER }], error: null };
  m.recent = { count: 0 };
  m.inserted = { data: { id: "w-1", received_at: "2026-10-04T23:11:23.000Z" }, error: null };
  for (const f of [m.ordersIlike, m.recentIlike, m.insert, m.finish]) f.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/boutique/retractation", () => {
  it("déclaration valide : enregistrée (rapprochée à l'unique commande payée), accusé programmé, horodatage serveur renvoyé", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" });
    expect(m.insert).toHaveBeenCalledWith({
      order_id: ORDER,
      order_number: null,
      match: "single",
      customer_name: "Jeanne Martin",
      customer_email: "jeanne@exemple.fr",
      details: null,
      locale: "fr",
    });
    expect(m.finish).toHaveBeenCalledTimes(1);
    expect(m.finish.mock.calls[0][1]).toBe("w-1");
  });

  it("numéro de commande reconnu parmi plusieurs : « exact », numéro normalisé, précisions gardées", async () => {
    m.orders = { data: [{ id: ORDER }, { id: OTHER }], error: null };
    await call({ ...good, commande: "xbz ffeedd cc", details: "  le maillot M seulement  " });
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: OTHER,
        order_number: "XBZ-FFEEDDCC",
        match: "exact",
        details: "le maillot M seulement",
      }),
    );
  });

  it("plusieurs commandes sans numéro : « ambiguous », rattachée à aucune, mais ENREGISTRÉE et acquittée", async () => {
    m.orders = { data: [{ id: ORDER }, { id: OTHER }], error: null };
    expect((await call()).status).toBe(200);
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ order_id: null, match: "ambiguous" }));
    expect(m.finish).toHaveBeenCalledTimes(1);
  });

  it("e-mail sans aucune commande payée : « none », enregistrée quand même (la réponse ne révèle rien)", async () => {
    m.orders = { data: [], error: null };
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" });
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ order_id: null, match: "none" }));
  });

  it("la recherche de commande ne tolère aucun joker (« _ » et « % » échappés)", async () => {
    await call({ ...good, email: "a_b%c@exemple.fr" });
    expect(m.ordersIlike).toHaveBeenCalledWith("customer_email", "a\\_b\\%c@exemple.fr");
    expect(m.recentIlike).toHaveBeenCalledWith("customer_email", "a\\_b\\%c@exemple.fr");
  });

  it("lecture des commandes en panne : la déclaration est quand même enregistrée, « non rapprochée »", async () => {
    m.orders = { data: null, error: { message: "boom" } };
    expect((await call()).status).toBe(200);
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ order_id: null, match: "none" }));
  });

  it("enregistrement impossible : 500, AUCUN accusé promis", async () => {
    m.inserted = { data: null, error: { message: "table absente" } };
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("saveFailed");
    expect(m.finish).not.toHaveBeenCalled();
  });

  it("langue : « en » conservée, toute autre valeur retombe sur le français", async () => {
    await call({ ...good, locale: "en" });
    expect(m.insert).toHaveBeenLastCalledWith(expect.objectContaining({ locale: "en" }));
    await call({ ...good, locale: "de" });
    expect(m.insert).toHaveBeenLastCalledWith(expect.objectContaining({ locale: "fr" }));
  });

  it("plafond d'accusés par adresse et par jour : déclaration gardée, envoi automatique suspendu, staff prévenu", async () => {
    m.recent = { count: MAX_ACK_PER_EMAIL_PER_DAY };
    expect((await call()).status).toBe(200);
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ ack_attempts: MAX_ACK_ATTEMPTS, ack_error: expect.stringMatching(/plafond/) }),
    );
    expect(m.finish).toHaveBeenCalledTimes(1);
  });

  it("sous le plafond : l'envoi automatique n'est pas bridé", async () => {
    m.recent = { count: MAX_ACK_PER_EMAIL_PER_DAY - 1 };
    await call();
    expect(m.insert.mock.calls[0][0]).not.toHaveProperty("ack_attempts");
  });

  it("piège anti-bot rempli : réponse OK, rien d'enregistré ni d'envoyé", async () => {
    const res = await call({ ...good, website: "http://spam.test" });
    expect(res.status).toBe(200);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.finish).not.toHaveBeenCalled();
  });

  it("envoi trop rapide ou sans mesure du temps : 429 « tooFast »", async () => {
    for (const elapsed of ["300", undefined]) {
      const res = await call({ ...good, elapsed });
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("tooFast");
    }
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("trop de tentatives : 429 avec Retry-After", async () => {
    m.rate = { allowed: false, retryAfter: 60 };
    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("nom ou e-mail manquant : 400 ; e-mail mal formé : 422", async () => {
    expect((await call({ ...good, nom: "  " })).status).toBe(400);
    expect((await call({ ...good, email: "" })).status).toBe(400);
    for (const email of ["pas-un-mail", "a b@c.fr", "a@b", "a@b.fr\r\nBcc: x@y.fr"]) {
      const res = await call({ ...good, email });
      expect(res.status, email).toBe(422);
      expect((await res.json()).code).toBe("invalidEmail");
    }
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("champ trop long : 422 avec le nom du champ et la limite", async () => {
    const res = await call({ ...good, details: "d".repeat(FIELD_MAX.details + 1) });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "tooLong", params: { field: "details", max: FIELD_MAX.details } });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("champ qui n'est pas du texte (tableau, objet) : 400, pas de contournement des plafonds", async () => {
    expect((await call({ ...good, nom: ["x".repeat(500)] })).status).toBe(400);
    expect((await call({ ...good, details: { a: 1 } })).status).toBe(400);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("corps absent, illisible ou qui n'est pas un objet : 400", async () => {
    expect((await call("{oups")).status).toBe(400);
    expect((await call("[1,2]")).status).toBe(400);
    expect((await call("null")).status).toBe(400);
  });

  it("appel venu d'un autre site : 403, avant tout traitement", async () => {
    expect((await call(good, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(m.insert).not.toHaveBeenCalled();
  });
});
