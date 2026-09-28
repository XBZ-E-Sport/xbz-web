// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

import { formatDate, articleCategoryStyles, articleCategoryTone } from "@/lib/format";
import { compileGlobalsCss } from "../../test/css";

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
    expect(Object.keys(articleCategoryTone).sort()).toEqual(Object.keys(articleCategoryStyles).sort());
  });

  // Couleurs autorisées par teinte : la charte (rouge #dc2515, jaune #fccd05,
  // leurs éclaircis de texte) et le blanc pour le neutre. Rien d'autre.
  const PALETTE = {
    red: ["xbz-blue", "#f4a79b"],
    yellow: ["xbz-cyan", "#ffd964", "rgba(252,205,5,"],
    neutral: ["white"],
  } as const;

  it.each(Object.entries(articleCategoryStyles))("%s : badge dans sa teinte de charte, sans autre couleur", (category, classes) => {
    const allowed: readonly string[] = PALETTE[articleCategoryTone[category as keyof typeof articleCategoryTone]];
    const colors = classes.split(/\s+/).flatMap((c) => {
      const m = c.match(/^(?:bg|text|ring|border)-(?:\[(.+)\]|([a-z-]+?))(?:\/\d+)?$/);
      return m && !/^(?:inset|\d+)$/.test(m[2] ?? "") ? [m[1] ?? m[2]] : [];
    });
    expect(colors.length, category).toBeGreaterThan(0);
    for (const color of colors) {
      expect(allowed.some((a) => color.startsWith(a)), `${category} : ${color}`).toBe(true);
    }
  });

  it("les cinq badges restent distincts (teinte pleine ou liseré)", () => {
    expect(new Set(Object.values(articleCategoryStyles)).size).toBe(5);
  });
});

describe("badges d'article — CSS compilé (prod)", () => {
  let css = "";
  beforeAll(async () => {
    css = await compileGlobalsCss();
  }, 60_000);

  it("chaque classe des badges existe dans le CSS compilé", () => {
    for (const cls of new Set(Object.values(articleCategoryStyles).flatMap((s) => s.split(/\s+/)))) {
      const selector = `.${cls.replace(/[^\w-]/g, (c) => `\\${c}`)}{`;
      expect(css.includes(selector), cls).toBe(true);
    }
  });
});
