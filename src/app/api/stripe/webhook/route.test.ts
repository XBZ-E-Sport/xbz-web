// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";

const m = vi.hoisted(() => ({ recordPayment: vi.fn(), releaseFromSession: vi.fn(), recordRefund: vi.fn() }));
vi.mock("@/lib/shop", () => m);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
// Vrai SDK pour la vérification de signature (clé factice, aucun appel réseau).
vi.mock("@/lib/stripe", () => {
  const client = new Stripe("sk_test_factice");
  return { stripe: () => client };
});

import { POST } from "@/app/api/stripe/webhook/route";

const SECRET = "whsec_test_secret";
const sdk = new Stripe("sk_test_factice");

function signed(event: Record<string, unknown>, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = sdk.webhooks.generateTestHeaderString({ payload, secret });
  return POST(new Request("https://xbz.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header }, body: payload }));
}
const event = (type: string, object: Record<string, unknown>) => ({ id: "evt_1", object: "event", type, data: { object } });

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  for (const f of Object.values(m)) f.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/stripe/webhook", () => {
  it("refuse (500) si le secret n'est pas configuré", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(new Request("https://xbz.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "x" }, body: "{}" }));
    expect(res.status).toBe(500);
  });

  it("refuse (400) un appel sans signature, ou mal signé — rien n'est enregistré", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const none = await POST(new Request("https://xbz.test/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(none.status).toBe(400);
    const forged = await signed(event("checkout.session.completed", { id: "cs_1" }), "whsec_pirate");
    expect(forged.status).toBe(400);
    expect(m.recordPayment).not.toHaveBeenCalled();
  });

  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("%s → paiement enregistré", async (type) => {
    const res = await signed(event(type, { id: "cs_1", payment_status: "paid" }));
    expect(res.status).toBe(200);
    expect(m.recordPayment).toHaveBeenCalledWith({}, expect.objectContaining({ id: "cs_1" }));
  });

  it.each(["checkout.session.expired", "checkout.session.async_payment_failed"])("%s → stock rendu", async (type) => {
    await signed(event(type, { id: "cs_1" }));
    expect(m.releaseFromSession).toHaveBeenCalledWith({}, expect.objectContaining({ id: "cs_1" }));
  });

  it("charge.refunded → remboursement enregistré", async () => {
    await signed(event("charge.refunded", { id: "ch_1", refunded: true }));
    expect(m.recordRefund).toHaveBeenCalledWith({}, expect.objectContaining({ id: "ch_1" }));
  });

  it("événement non géré : 200 sans rien faire (Stripe cesse de le renvoyer)", async () => {
    const res = await signed(event("customer.created", { id: "cus_1" }));
    expect(res.status).toBe(200);
    expect(Object.values(m).every((f) => f.mock.calls.length === 0)).toBe(true);
  });

  it("erreur de traitement : 500 pour que Stripe réessaie", async () => {
    m.recordPayment.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await signed(event("checkout.session.completed", { id: "cs_1", payment_status: "paid" }));
    expect(res.status).toBe(500);
  });
});
