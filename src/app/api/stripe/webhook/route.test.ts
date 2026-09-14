// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Le webhook ne doit RIEN enregistrer tant qu'il n'a pas prouvé que l'appel
// vient de Stripe. On teste les deux refus qui protègent ça, sans toucher à
// Stripe ni à la base : ces branches renvoient avant d'y arriver.

import { POST } from "@/app/api/stripe/webhook/route";

const call = (headers: Record<string, string> = {}, body = "{}") =>
  POST(new Request("https://xbz.test/api/stripe/webhook", { method: "POST", headers, body }));

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/stripe/webhook", () => {
  it("refuse (500) si le secret de signature n'est pas configuré", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await call({ "stripe-signature": "peu importe" });
    expect(res.status).toBe(500);
  });

  it("refuse (400) un appel sans en-tête de signature Stripe", async () => {
    const res = await call({});
    expect(res.status).toBe(400);
  });
});
