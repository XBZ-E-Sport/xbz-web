// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { compileGlobalsCss, sourceFiles } from "../../test/css";

/**
 * Polices : on ne précharge sur une page que ce qu'elle affiche.
 *
 * Une police déclarée par le layout racine est préchargée sur TOUTES les pages.
 * Oswald (mots-chocs) et Special Gothic (slogan) ne servent qu'à l'accueil et à
 * la 404 : elles vivent dans `home-fonts.ts`, et leur variable CSS se pose sur
 * l'élément qui les utilise. Oublier cette variable ne casse rien de visible au
 * build — le texte retombe en police système. Ce test le voit.
 */

/** Code sans ses commentaires : on cherche du code, pas des mots. */
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const files = sourceFiles().map((f) => ({ ...f, code: strip(f.code) }));
const layout = strip(readFileSync(join(process.cwd(), "src", "app", "[locale]", "layout.tsx"), "utf8"));

/** Valeurs des attributs className d'un fichier (chaîne ou gabarit). */
const classNames = (code: string) =>
  [...code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);

describe("polices", () => {
  it("le layout ne déclare que les polices de toutes les pages", () => {
    expect(layout).not.toMatch(/\bOswald\b|Special_Gothic_Expanded_One/);
    expect(layout).toMatch(/Bruno_Ace_SC\(/);
    expect(layout).toMatch(/Sarabun\(/);
  });

  it("Sarabun : pas de graisse inutilisée (le 500 n'est utilisé nulle part)", () => {
    expect(files.some((f) => /\bfont-medium\b/.test(f.code)), "font-medium réapparu : remettre 500").toBe(false);
    expect(layout).toMatch(/weight: \["400", "600", "700"\]/);
  });

  it("home-fonts n'est importé que par l'accueil", () => {
    // Pas par not-found.tsx : frontière 404 du layout, il est dans l'arbre de
    // TOUTES les pages — ses polices préchargées le seraient partout (mesuré).
    const importers = files.filter((f) => /from "(?:\.\/|@\/app\/\[locale\]\/)home-fonts"/.test(f.code)).map((f) => f.label);
    expect(importers).toEqual(["src/app/[locale]/page.tsx"]);
  });

  it("les fichiers présents sur toutes les pages ne préchargent aucune police en plus", () => {
    // Frontières du segment [locale] : rendues avec n'importe quelle page.
    for (const name of ["not-found.tsx", "error.tsx", "loading.tsx"]) {
      const f = files.find((x) => x.label === `src/app/[locale]/${name}`);
      if (!f) continue;
      const calls = [...f.code.matchAll(/\b[A-Z][A-Za-z_]+\(\{[^}]*subsets[^}]*\}\)/g)].map((m) => m[0]);
      for (const call of calls) expect(call, name).toMatch(/preload:\s*false/);
    }
  });

  it.each([
    ["font-impact", "fontImpact"],
    ["font-subtitle", "fontSubtitle"],
  ])("chaque élément en %s porte la variable de sa police", (utility, font) => {
    const uses = files.flatMap((f) =>
      classNames(f.code)
        .filter((c) => new RegExp(`(?:^|\\s)${utility}(?:\\s|$)`).test(c))
        .map((c) => ({ label: f.label, ok: c.includes(`\${${font}.variable}`) })),
    );
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((u) => !u.ok).map((u) => u.label)).toEqual([]);
  });

  describe("CSS compilé", () => {
    let css = "";
    beforeAll(async () => {
      css = await compileGlobalsCss();
    }, 60_000);

    it("les utilitaires résolvent la variable SUR l'élément (@theme inline)", () => {
      expect(css).toMatch(/\.font-impact\{font-family:var\(--font-impact-family\)/);
      expect(css).toMatch(/\.font-subtitle\{font-family:var\(--font-subtitle-family\)/);
    });
  });
});
