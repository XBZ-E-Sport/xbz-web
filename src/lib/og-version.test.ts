// @vitest-environment node
import { describe, it, expect } from "vitest";

import { bannerVersion, ogAlt, ogContentVersion, OG_DEPLOY_VERSION, type Banner } from "@/lib/og-version";

const base: Banner = {
  frame: { eyebrow: "Résultats", title: "Victoire en finale", subtitle: "3-1 face à Nova", tone: "red" },
  alt: "Victoire en finale — XBZ Esport",
};

describe("og-version", () => {
  it("donne un identifiant court, sûr dans une URL, et stable pour un même contenu", () => {
    const id = bannerVersion(base);
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(bannerVersion(structuredClone(base))).toBe(id);
  });

  it.each(["eyebrow", "title", "subtitle", "tone"] as const)(
    "change dès que le texte affiché change (%s)",
    (field) => {
      const changed: Banner = { ...base, frame: { ...base.frame, [field]: field === "tone" ? "yellow" : "autre" } };
      expect(bannerVersion(changed)).not.toBe(bannerVersion(base));
    },
  );

  it("ne confond pas deux découpages du même texte", () => {
    // Le séparateur évite qu'« ab » + « c » et « a » + « bc » partagent un identifiant.
    expect(ogContentVersion("ab", "c")).not.toBe(ogContentVersion("a", "bc"));
  });

  it("la version de déploiement est courte (7 caractères au plus)", () => {
    expect(OG_DEPLOY_VERSION.length).toBeGreaterThan(0);
    expect(OG_DEPLOY_VERSION.length).toBeLessThanOrEqual(7);
  });

  it("le texte alternatif porte le nom du club", () => {
    expect(ogAlt("Nos équipes")).toBe("Nos équipes — XBZ Esport");
  });
});
