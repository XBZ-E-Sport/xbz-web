// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { insertMock, singleResult, rateLimitMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  singleResult: { value: { data: { id: "sup-id" }, error: null } as { data: unknown; error: unknown } },
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insertMock(row);
        return { select: () => ({ single: async () => singleResult.value }) };
      },
    }),
  }),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...a: unknown[]) => rateLimitMock(...a),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      }),
  },
  after: () => {},
}));

import { POST } from "@/app/api/support/route";

const VALID = {
  nom: "Jean",
  email: "jean@test.fr",
  sujet: "Général",
  message: "Bonjour, ceci est un message de test suffisamment long.",
  consent: "on",
  website: "",
  elapsed: "5000",
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  insertMock.mockClear();
  singleResult.value = { data: { id: "sup-id" }, error: null };
  rateLimitMock.mockReset().mockResolvedValue({ allowed: true, retryAfter: 0 });
});

describe("POST /api/support", () => {
  it("message valide → 200 + insertion", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: "sup-id" });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("honeypot rempli → 200 silencieux, AUCUNE insertion", async () => {
    const res = await post({ ...VALID, website: "bot" });
    expect(res.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("envoi trop rapide → 429", async () => {
    expect((await post({ ...VALID, elapsed: "500" })).status).toBe(429);
  });

  it("rate-limit dépassé → 429", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });
    expect((await post(VALID)).status).toBe(429);
  });

  it("consentement manquant → 422", async () => {
    const res = await post({ ...VALID, consent: "" });
    expect(res.status).toBe(422);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("champs obligatoires manquants → 400", async () => {
    expect((await post({ ...VALID, message: "" })).status).toBe(400);
  });

  it("email invalide → 422", async () => {
    expect((await post({ ...VALID, email: "pas-un-email" })).status).toBe(422);
  });

  it("message trop court (< 10) → 422", async () => {
    expect((await post({ ...VALID, message: "court" })).status).toBe(422);
  });

  it("erreur BDD à l'insertion → 500", async () => {
    singleResult.value = { data: null, error: { message: "boom" } };
    expect((await post(VALID)).status).toBe(500);
  });
});
