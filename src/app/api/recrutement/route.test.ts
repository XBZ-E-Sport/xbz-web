// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks des dépendances BDD/infra ; la logique PURE (antispam, consent, âge)
// reste réelle — c'est justement son intégration dans la route qu'on teste.
const { insertMock, singleResult, rateLimitMock, isRoleOpenMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  singleResult: { value: { data: { id: "rec-id" }, error: null } as { data: unknown; error: unknown } },
  rateLimitMock: vi.fn(),
  isRoleOpenMock: vi.fn(),
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

vi.mock("@/lib/equipes", () => ({
  isRoleOpen: (...a: unknown[]) => isRoleOpenMock(...a),
}));

// next/server minimal : NextResponse.json + after no-op (pas de contexte Next en test).
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

import { FIELD_MAX } from "@/lib/limits";
import { POST } from "@/app/api/recrutement/route";

// Candidature Esport valide de référence.
const VALID = {
  categorie: "XBZ Esport",
  role: "Joueur",
  nom: "Jean Test",
  age: 20,
  discord: "jean_d",
  pseudo: "jean",
  jeu: "Rocket League",
  consent: "on",
  website: "", // honeypot vide
  elapsed: "5000", // temps de remplissage humain
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/recrutement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  insertMock.mockClear();
  singleResult.value = { data: { id: "rec-id" }, error: null };
  rateLimitMock.mockReset().mockResolvedValue({ allowed: true, retryAfter: 0 });
  isRoleOpenMock.mockReset().mockResolvedValue(true);
});

describe("POST /api/recrutement", () => {
  it("candidature valide → 200 + insertion", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: "rec-id" });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("honeypot rempli → 200 silencieux, AUCUNE insertion", async () => {
    const res = await post({ ...VALID, website: "bot" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("envoi trop rapide (bot) → 429", async () => {
    const res = await post({ ...VALID, elapsed: "500" });
    expect(res.status).toBe(429);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rate-limit dépassé → 429", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });
    expect((await post(VALID)).status).toBe(429);
  });

  it("consentement manquant → 422, AUCUNE insertion", async () => {
    const res = await post({ ...VALID, consent: "" });
    expect(res.status).toBe(422);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("champs obligatoires manquants → 400", async () => {
    expect((await post({ ...VALID, nom: "" })).status).toBe(400);
  });

  it("rôle fermé au recrutement → 422", async () => {
    isRoleOpenMock.mockResolvedValue(false);
    expect((await post(VALID)).status).toBe(422);
  });

  it("trop jeune pour l'Esport (min 16) → 422", async () => {
    expect((await post({ ...VALID, age: 15 })).status).toBe(422);
  });

  it("staff exige 18 ans → 422 à 17 ans", async () => {
    const res = await post({ ...VALID, categorie: "XBZ Staff", role: "Manager", jeu: "", age: 17 });
    expect(res.status).toBe(422);
  });

  it("Esport sans jeu → 422", async () => {
    expect((await post({ ...VALID, jeu: "" })).status).toBe(422);
  });

  it("champ libre trop long → 422, AUCUNE insertion", async () => {
    const res = await post({ ...VALID, motiv: "M".repeat(FIELD_MAX.motiv + 1) });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("Motivation");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("champ court trop long (maxLength contourné) → 422", async () => {
    const res = await post({ ...VALID, pseudo: "P".repeat(FIELD_MAX.pseudo + 1) });
    expect(res.status).toBe(422);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("valeurs pile à la limite → acceptées", async () => {
    const res = await post({
      ...VALID,
      nom: "N".repeat(FIELD_MAX.nom),
      motiv: "M".repeat(FIELD_MAX.motiv),
    });
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("erreur BDD à l'insertion → 500", async () => {
    singleResult.value = { data: null, error: { message: "boom" } };
    expect((await post(VALID)).status).toBe(500);
  });
});
