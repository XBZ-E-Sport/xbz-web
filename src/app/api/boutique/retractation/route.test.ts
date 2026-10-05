// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  rate: { allowed: true, retryAfter: 0 },
  hourly: { allowed: true, retryAfter: 0 },
  hourlyCall: vi.fn(),
  orders: { data: [] as { id: string; customer_email: string | null }[] | null, error: null as { message: string } | null },
  inserted: { data: { id: "w-1", received_at: "2026-10-04T23:11:23.000Z" } as unknown, error: null as { message: string } | null },
  ordersIlike: vi.fn(),
  ordersIn: vi.fn(),
  insert: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  getClientIp: () => "203.0.113.7",
  checkFormRateLimit: async () => m.rate,
  checkRateLimit: async (...args: unknown[]) => {
    m.hourlyCall(...args);
    return m.hourly;
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "orders"
        ? {
            select: () => ({
              in: (col: string, values: string[]) => {
                m.ordersIn(col, values);
                return {
                  ilike: (icol: string, pattern: string) => {
                    m.ordersIlike(icol, pattern);
                    return { order: () => ({ limit: async () => m.orders }) };
                  },
                };
              },
            }),
          }
        : {
            insert: (row: unknown) => {
              m.insert(row);
              return { select: () => ({ single: async () => m.inserted }) };
            },
          },
  }),
}));
vi.mock("@/lib/withdrawal-server", () => ({ finishWithdrawalAfterResponse: m.finish }));
vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: vi.fn() }));

import { POST } from "@/app/api/boutique/retractation/route";
import { FIELD_MAX } from "@/lib/limits";

const ORDER = "1a2b3c4d-0000-4000-8000-000000000001";
const OTHER = "ffeeddcc-0000-4000-8000-000000000002";
const MAIL = "jeanne@exemple.fr";
const good = {
  nom: "Jeanne Martin",
  email: MAIL,
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

const inserted = () => m.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  m.rate = { allowed: true, retryAfter: 0 };
  m.hourly = { allowed: true, retryAfter: 0 };
  m.orders = { data: [{ id: ORDER, customer_email: MAIL }], error: null };
  m.inserted = { data: { id: "w-1", received_at: "2026-10-04T23:11:23.000Z" }, error: null };
  for (const f of [m.hourlyCall, m.ordersIlike, m.ordersIn, m.insert, m.finish]) f.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/boutique/retractation — enregistrement et rapprochement", () => {
  it("déclaration valide : enregistrée, rapprochée à l'unique commande payée, accusé programmé, horodatage serveur renvoyé", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" });
    expect(inserted()).toEqual({
      order_id: ORDER,
      order_number: null,
      match: "single",
      customer_name: "Jeanne Martin",
      customer_email: MAIL,
      details: null,
      locale: "fr",
      mailbox_key: MAIL,
      suspect: false,
    });
    expect(m.ordersIn).toHaveBeenCalledWith("status", ["paid", "fulfilled"]);
    expect(m.finish).toHaveBeenCalledTimes(1);
    expect(m.finish.mock.calls[0][1]).toBe("w-1");
  });

  it("numéro reconnu parmi plusieurs : « exact » ; ce que le client a tapé est gardé TEL QUEL", async () => {
    m.orders = { data: [{ id: ORDER, customer_email: MAIL }, { id: OTHER, customer_email: MAIL }], error: null };
    await call({ ...good, commande: "xbz ffeedd cc", details: "  le maillot M seulement  " });
    expect(inserted()).toMatchObject({
      order_id: OTHER,
      order_number: "xbz ffeedd cc",
      match: "exact",
      details: "le maillot M seulement",
    });
  });

  it("numéro valide mais inconnu de cet e-mail : « mismatch », non rattachée à « la seule commande », texte du client conservé", async () => {
    await call({ ...good, commande: "XBZ-00000000" });
    expect(inserted()).toMatchObject({ order_id: null, order_number: "XBZ-00000000", match: "mismatch" });
    expect(m.finish).toHaveBeenCalledTimes(1);
  });

  it("texte libre à la place du numéro : conservé, et le rapprochement se fait par l'e-mail", async () => {
    await call({ ...good, commande: "ma commande du 3 octobre" });
    expect(inserted()).toMatchObject({ order_id: ORDER, order_number: "ma commande du 3 octobre", match: "single" });
  });

  it("plusieurs commandes sans numéro : « ambiguous », rattachée à aucune, mais ENREGISTRÉE et acquittée", async () => {
    m.orders = { data: [{ id: ORDER, customer_email: MAIL }, { id: OTHER, customer_email: MAIL }], error: null };
    expect((await call()).status).toBe(200);
    expect(inserted()).toMatchObject({ order_id: null, match: "ambiguous" });
    expect(m.finish).toHaveBeenCalledTimes(1);
  });

  it("e-mail sans commande payée : « none », enregistrée quand même, la réponse ne révèle rien", async () => {
    m.orders = { data: [], error: null };
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" });
    expect(inserted()).toMatchObject({ order_id: null, match: "none" });
  });

  it("la recherche ne tolère aucun joker : motif neutralisé ET adresses non identiques écartées", async () => {
    // « * » est lu comme « % » par PostgREST : le motif le réduit à UN caractère…
    m.orders = { data: [{ id: OTHER, customer_email: "aXb@exemple.fr" }], error: null };
    await call({ ...good, email: "a*b@exemple.fr" });
    expect(m.ordersIlike).toHaveBeenCalledWith("customer_email", "a_b@exemple.fr");
    // …et la commande d'une AUTRE adresse, ramenée par ce motif, n'est jamais rattachée.
    expect(inserted()).toMatchObject({ order_id: null, match: "none" });

    await call({ ...good, email: "a_b%c@exemple.fr" });
    expect(m.ordersIlike).toHaveBeenLastCalledWith("customer_email", "a\\_b\\%c@exemple.fr");
  });

  it("l'adresse comparée ignore la casse (celle de Stripe n'est pas celle du formulaire)", async () => {
    m.orders = { data: [{ id: ORDER, customer_email: "Jeanne@Exemple.FR" }], error: null };
    await call();
    expect(inserted()).toMatchObject({ order_id: ORDER, match: "single" });
  });

  it("boîte aux lettres normalisée pour plafonner les accusés (« +tag », points de Gmail)", async () => {
    await call({ ...good, email: "V.ictim+7@Gmail.com" });
    expect(inserted()).toMatchObject({ customer_email: "V.ictim+7@Gmail.com", mailbox_key: "victim@gmail.com" });
  });

  it("lecture des commandes en panne : la déclaration est quand même enregistrée, « non rapprochée »", async () => {
    m.orders = { data: null, error: { message: "boom" } };
    expect((await call()).status).toBe(200);
    expect(inserted()).toMatchObject({ order_id: null, match: "none" });
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
    expect(inserted()).toMatchObject({ locale: "en" });
    await call({ ...good, locale: "de" });
    expect(inserted()).toMatchObject({ locale: "fr" });
  });
});

describe("POST /api/boutique/retractation — anti-abus", () => {
  it("piège anti-bot rempli : la déclaration est GARDÉE (jamais perdue en silence), marquée suspecte, le staff est alerté", async () => {
    const res = await call({ ...good, website: "http://spam.test" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" });
    expect(inserted()).toMatchObject({ suspect: true, customer_email: MAIL });
    expect(m.finish).toHaveBeenCalledTimes(1);
  });

  it("envoi trop rapide ou sans mesure du temps : 429 « tooFast »", async () => {
    for (const elapsed of ["300", undefined]) {
      const res = await call({ ...good, elapsed });
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("tooFast");
    }
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("trop de tentatives à la minute : 429 avec Retry-After, rien n'est lu ni écrit", async () => {
    m.rate = { allowed: false, retryAfter: 60 };
    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(m.hourlyCall).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("plafond HORAIRE par IP : 429 aussi, et le limiteur horaire est bien appelé (12 par heure)", async () => {
    m.hourly = { allowed: false, retryAfter: 3600 };
    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(m.hourlyCall).toHaveBeenCalledWith("203.0.113.7", "retractation:h", { limit: 12, windowSeconds: 3600 });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("appel venu d'un autre site : 403 ; corps qui n'est pas du JSON déclaré : 415 — avant tout traitement", async () => {
    expect((await call(good, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await call(good, { "content-type": "text/plain" })).status).toBe(415);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.hourlyCall).not.toHaveBeenCalled();
  });
});

describe("POST /api/boutique/retractation — validation", () => {
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

  it("les LONGUEURS sont vérifiées avant l'expression régulière : un e-mail géant est refusé « trop long », sans la lui faire parcourir", async () => {
    const started = Date.now();
    const res = await call({ ...good, email: `${"a@".repeat(40_000)}x` });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("tooLong");
    expect(Date.now() - started).toBeLessThan(1000);
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
});
