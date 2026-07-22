import { describe, it, expect } from "vitest";

import { minAgeForCategory } from "@/content/recrutement";

describe("minAgeForCategory", () => {
  it("exige 18 ans pour le staff", () => {
    expect(minAgeForCategory("XBZ Staff")).toBe(18);
  });

  it("exige 16 ans pour l'esport", () => {
    expect(minAgeForCategory("XBZ Esport")).toBe(16);
  });

  it("retombe sur 16 ans pour une catégorie vide ou inconnue", () => {
    expect(minAgeForCategory("")).toBe(16);
    expect(minAgeForCategory("Autre")).toBe(16);
  });
});
