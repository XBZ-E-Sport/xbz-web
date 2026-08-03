import { describe, it, expect } from "vitest";

import { formatDate, articleCategoryStyles } from "@/lib/format";

describe("formatDate", () => {
  it("formate une date ISO en français (fuseau Paris)", () => {
    expect(formatDate("2026-07-14")).toBe("14 juillet 2026");
  });

  it("gère un autre mois", () => {
    expect(formatDate("2026-01-05")).toBe("5 janvier 2026");
  });

  it("formate en anglais quand la langue est en", () => {
    expect(formatDate("2026-07-14", "en")).toBe("July 14, 2026");
  });

  it("garde le fuseau Paris en anglais (pas de décalage de jour)", () => {
    expect(formatDate("2026-01-05", "en")).toBe("January 5, 2026");
  });
});

describe("articleCategoryStyles", () => {
  it("couvre exactement les cinq catégories d'article", () => {
    expect(Object.keys(articleCategoryStyles).sort()).toEqual(
      ["Annonce", "Communauté", "Compétition", "Création", "Recrutement"].sort(),
    );
  });
});
