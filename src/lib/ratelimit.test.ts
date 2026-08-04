import { describe, it, expect, vi, beforeEach } from "vitest";

const { countMock, insertMock, deleteMock } = vi.hoisted(() => ({
  countMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
}));

// Client admin factice : on rejoue le chaînage PostgREST utilisé par le module.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ gte: () => countMock() }) }) }),
      insert: (row: unknown) => insertMock(row),
      delete: () => ({ lt: () => deleteMock() }),
    }),
  }),
}));

import { getClientIp, checkRateLimit } from "@/lib/ratelimit";

function req(headers: Record<string, string>): Request {
  return new Request("https://xbz-esport.fr/api/x", { headers });
}

describe("getClientIp", () => {
  it("préfère x-real-ip, que le client ne peut pas imposer", () => {
    expect(getClientIp(req({ "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
    // Même quand une liste falsifiée l'accompagne.
    expect(
      getClientIp(req({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "6.6.6.6" })),
    ).toBe("10.0.0.1");
  });

  it("prend la DERNIÈRE entrée de x-forwarded-for", () => {
    // C'est le nerf de la protection : la première entrée est celle qu'un
    // client a pu écrire lui-même, la dernière est ajoutée par le relais.
    // En prendre la première, c'est offrir une identité neuve à chaque envoi
    // — l'anti-flood ne compte alors plus rien.
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("trim les espaces autour de l'IP", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  9.9.9.9  " }))).toBe("9.9.9.9");
  });

  it("retourne 'unknown' sans aucun en-tête d'IP", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });

  it("retourne 'unknown' plutôt qu'une chaîne vide sur un en-tête vide", () => {
    // Sinon deux visiteurs distincts partageraient le compteur de la clé "".
    expect(getClientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    countMock.mockReset().mockResolvedValue({ count: 0, error: null });
    insertMock.mockReset().mockResolvedValue({ error: null });
    deleteMock.mockReset().mockResolvedValue({ error: null });
  });

  it("laisse passer sous le seuil et enregistre le passage", async () => {
    countMock.mockResolvedValue({ count: 2, error: null });
    expect(await checkRateLimit("1.1.1.1", "support", { limit: 5 })).toEqual({
      allowed: true,
      retryAfter: 0,
    });
    expect(insertMock).toHaveBeenCalledWith({ ip: "1.1.1.1", route: "support" });
  });

  it("refuse au seuil atteint, sans rien enregistrer de plus", async () => {
    countMock.mockResolvedValue({ count: 5, error: null });
    const res = await checkRateLimit("1.1.1.1", "support", { limit: 5, windowSeconds: 60 });
    expect(res).toEqual({ allowed: false, retryAfter: 60 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("REFUSE par défaut quand le compteur lui-même est en panne", async () => {
    // Sur un formulaire public, l'étape suivante écrit dans cette même base :
    // si la lecture échoue, l'enregistrement échouera aussi. Laisser passer
    // n'aiderait personne et ouvrirait la porte au spam au pire moment.
    countMock.mockResolvedValue({ count: null, error: { message: "supabase down" } });
    expect(await checkRateLimit("1.1.1.1", "support", { windowSeconds: 60 })).toEqual({
      allowed: false,
      retryAfter: 60,
    });
  });

  it("laisse passer en panne quand l'appelant le demande explicitement", async () => {
    // Cas de la remontée d'erreurs : elle part vers Discord, pas vers Supabase.
    countMock.mockResolvedValue({ count: null, error: { message: "supabase down" } });
    expect(
      await checkRateLimit("1.1.1.1", "report-error", { failOpen: true }),
    ).toEqual({ allowed: true, retryAfter: 0 });
  });
});
