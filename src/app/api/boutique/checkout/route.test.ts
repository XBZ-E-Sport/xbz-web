// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({
  configured: true,
  live: false,
  rate: { allowed: true, retryAfter: 0 },
  reserve: vi.fn(),
  abandon: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  jar: new Map<string, string>(),
  setCookie: vi.fn(),
}));

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (m.jar.has(k) ? { value: m.jar.get(k) } : undefined),
    set: m.setCookie,
    delete: vi.fn(),
  }),
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => m.configured,
  isLiveStripeKey: () => m.live,
  stripe: () => ({ checkout: { sessions: { create: m.create } } }),
}));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: () => "203.0.113.7",
  rateLimitKey: (ip: string) => ip,
  checkRateLimit: async () => m.rate,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update: (v: unknown) => ({ eq: (...a: unknown[]) => m.update(v, ...a) }) }) }),
}));
vi.mock("@/lib/shop", async (orig) => ({
  ...(await orig<typeof import("@/lib/shop")>()),
  reserveOrder: m.reserve,
  abandonOrder: m.abandon,
  sweepStaleReservations: vi.fn(),
}));

import { POST } from "@/app/api/boutique/checkout/route";
import { LEGAL } from "@/lib/legal";

const VARIANT = "00000000-0000-4000-8000-000000000001";
const ORDER = { id: "0b6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d", items: [], shipping: 4.9, locale: "fr", expires_at: null };
const good = { lines: [{ variantId: VARIANT, quantity: 1 }], locale: "fr", terms: true };

const call = (body: unknown = good, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://xbz.test/api/boutique/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  m.configured = true;
  m.live = false;
  m.rate = { allowed: true, retryAfter: 0 };
  m.jar.clear();
  for (const f of [m.reserve, m.abandon, m.create, m.update, m.setCookie]) f.mockReset();
  m.reserve.mockResolvedValue({ ok: true, order: ORDER });
  m.abandon.mockResolvedValue(true);
  m.create.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });
  m.update.mockResolvedValue({ error: null });
});

describe("POST /api/boutique/checkout", () => {
  it("panier valide : réserve, ouvre la page Stripe, renvoie son adresse et pose le cookie", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(m.reserve).toHaveBeenCalledWith(expect.anything(), good.lines, "fr");
    expect(m.update).toHaveBeenCalledWith({ stripe_session_id: "cs_1" }, "id", ORDER.id);
    expect(m.setCookie).toHaveBeenCalledWith("xbz_checkout", ORDER.id, expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
    // Témoin lisible par la page panier (aucun identifiant dedans).
    const flag = m.setCookie.mock.calls.find((c) => c[0] === "xbz_checkout_open");
    expect(flag?.[1]).toBe("1");
    expect(flag?.[2]).not.toHaveProperty("httpOnly");
    // Une seule page de paiement par commande, même si le SDK rejoue la requête.
    expect(m.create.mock.calls[0][1]).toEqual({ idempotencyKey: `checkout-${ORDER.id}` });
  });

  it("refuse un appel venu d'un autre site, ou qui n'est pas du JSON", async () => {
    expect((await call(good, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await call(good, { "content-type": "text/plain" })).status).toBe(415);
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("boutique non branchée à Stripe : 503 « unavailable »", async () => {
    m.configured = false;
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("unavailable");
  });

  it("panier mal formé ou CGV non acceptées : refusés AVANT toute réservation", async () => {
    expect((await call("{oups")).status).toBe(400);
    expect((await call({ ...good, lines: [{ variantId: VARIANT, quantity: 99 }] })).status).toBe(400);
    const terms = await call({ ...good, terms: false });
    expect(terms.status).toBe(422);
    expect((await terms.json()).code).toBe("terms");
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("trop de tentatives : 429", async () => {
    m.rate = { allowed: false, retryAfter: 900 };
    const res = await call();
    expect(res.status).toBe(429);
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("stock insuffisant : 409 avec les tailles concernées, aucune page Stripe", async () => {
    m.reserve.mockResolvedValue({ ok: false, reason: "stock", unavailable: [VARIANT] });
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, code: "stock", unavailable: [VARIANT] });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("Stripe en panne : le stock réservé est rendu aussitôt, 502", async () => {
    m.create.mockRejectedValue(new Error("stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call();
    expect(res.status).toBe(502);
    expect(m.abandon).toHaveBeenCalledWith(expect.anything(), ORDER.id);
    expect(m.setCookie).not.toHaveBeenCalled();
  });

  it("une commande en attente de CE navigateur est abandonnée avant d'en ouvrir une autre", async () => {
    m.jar.set("xbz_checkout", "11111111-1111-4111-8111-111111111111");
    await call();
    expect(m.abandon).toHaveBeenCalledWith(expect.anything(), "11111111-1111-4111-8111-111111111111");
    expect(m.abandon.mock.invocationCallOrder[0]).toBeLessThan(m.reserve.mock.invocationCallOrder[0]);
  });

  it("le prix envoyé par le navigateur est ignoré (seules tailles et quantités comptent)", async () => {
    await call({ ...good, lines: [{ variantId: VARIANT, quantity: 1, price: 0.01 }] });
    expect(m.reserve).toHaveBeenCalledWith(expect.anything(), [{ variantId: VARIANT, quantity: 1 }], "fr");
  });
});

describe("POST /api/boutique/checkout — vrais paiements et informations légales", () => {
  const mediator = { name: "Médiateur de test", address: "1 rue du Test, 75000 Paris", website: "https://mediateur.test" };
  const saved = { ...LEGAL };
  const ready = { mediator, phone: "02 35 00 00 00", onlineWithdrawal: true };
  afterEach(() => {
    Object.assign(LEGAL, saved);
    vi.restoreAllMocks();
  });

  it("clé LIVE sans médiateur de la consommation : paiement refusé, rien n'est réservé", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    log.mockClear();
    m.live = true;
    Object.assign(LEGAL, ready, { mediator: null });
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("unavailable");
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
    expect(log.mock.calls.some((c) => /médiateur/.test(String(c[0])))).toBe(true);
  });

  it("clé LIVE avec médiateur mais sans rétractation en ligne : paiement refusé aussi", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    log.mockClear();
    m.live = true;
    Object.assign(LEGAL, ready, { onlineWithdrawal: false });
    const res = await call();
    expect(res.status).toBe(503);
    expect(m.reserve).not.toHaveBeenCalled();
    expect(log.mock.calls.some((c) => /rétractation/.test(String(c[0])))).toBe(true);
  });

  it("clé LIVE sans numéro de téléphone : paiement refusé aussi", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    log.mockClear();
    m.live = true;
    Object.assign(LEGAL, ready, { phone: null });
    expect((await call()).status).toBe(503);
    expect(m.reserve).not.toHaveBeenCalled();
    expect(log.mock.calls.some((c) => /téléphone/.test(String(c[0])))).toBe(true);
  });

  it("clé LIVE avec médiateur, téléphone ET rétractation en ligne : le paiement s'ouvre", async () => {
    m.live = true;
    Object.assign(LEGAL, ready);
    const res = await call();
    expect(res.status).toBe(200);
    expect(m.reserve).toHaveBeenCalledTimes(1);
  });

  it("clé de TEST sans médiateur : la boutique reste utilisable pour essayer", async () => {
    m.live = false;
    Object.assign(LEGAL, { mediator: null, phone: null, onlineWithdrawal: false });
    expect((await call()).status).toBe(200);
  });
});
