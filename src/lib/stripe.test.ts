import { afterEach, describe, expect, it, vi } from "vitest";

import { LEGAL } from "@/lib/legal";
import { isLiveStripeKey, isShopOpen } from "@/lib/stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLiveStripeKey", () => {
  it.each(["sk_live_abc123", "rk_live_abc123"])("%s : clé de vrais paiements", (key) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    expect(isLiveStripeKey()).toBe(true);
  });

  it.each(["sk_test_abc123", "rk_test_abc123", "", "pk_live_abc123", "xsk_live_abc", "SK_LIVE_abc"])(
    "%j : pas une clé live",
    (key) => {
      vi.stubEnv("STRIPE_SECRET_KEY", key);
      expect(isLiveStripeKey()).toBe(false);
    },
  );

  it("variable absente : pas une clé live", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", undefined as unknown as string);
    delete process.env.STRIPE_SECRET_KEY;
    expect(isLiveStripeKey()).toBe(false);
  });
});

describe("isShopOpen", () => {
  const saved = { ...LEGAL };
  afterEach(() => {
    Object.assign(LEGAL, saved);
  });

  const configure = (key: string) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  };

  it("Stripe non branché : fermée", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(isShopOpen()).toBe(false);
  });

  it("clé de test : ouverte même si les obligations légales manquent (pour essayer)", () => {
    configure("sk_test_abc");
    Object.assign(LEGAL, { mediator: null, phone: null, onlineWithdrawal: false });
    expect(isShopOpen()).toBe(true);
  });

  it("clé live : fermée tant qu'il manque le médiateur, le téléphone OU la rétractation en ligne", () => {
    configure("sk_live_abc");
    const ready = {
      mediator: { name: "M", address: "1 rue X", website: "https://m.test" },
      phone: "02 35 00 00 00",
      onlineWithdrawal: true,
    };

    for (const missing of ["mediator", "phone", "onlineWithdrawal"] as const) {
      Object.assign(LEGAL, ready, { [missing]: missing === "onlineWithdrawal" ? false : null });
      expect(isShopOpen(), missing).toBe(false);
    }

    Object.assign(LEGAL, ready);
    expect(isShopOpen()).toBe(true);
  });
});
