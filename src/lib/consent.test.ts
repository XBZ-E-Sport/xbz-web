import { describe, expect, it } from "vitest";

import { hasConsent } from "@/lib/consent";

describe("hasConsent", () => {
  it("accepte une case cochée (toutes les formes)", () => {
    for (const v of ["on", "true", "1", true]) {
      expect(hasConsent(v)).toBe(true);
    }
  });

  it("refuse l'absence de consentement", () => {
    for (const v of [undefined, null, "", "off", "false", false, 0, "no", "0"]) {
      expect(hasConsent(v)).toBe(false);
    }
  });
});
