// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

import { GLOBALS_CSS, compileGlobalsCss, cssRules, declarations } from "../../test/css";

/**
 * Contour de focus clavier sur les éléments à coin coupé.
 *
 * Leur `clip-path` rogne tout ce qui dépasse de leur boîte — contour de focus
 * compris. Avec le décalage global (+3 px, à l'extérieur), les cartes
 * cliquables et le bouton Discord de l'accueil n'avaient AUCUN focus visible
 * (mesuré : 0 pixel de différence entre carte focalisée et non focalisée).
 * Chaque classe découpée doit donc dessiner son contour à l'intérieur.
 */

const CLIPPED = [".card-xbz", ".cut", ".cut-tl"];

function check(label: string, css: () => string) {
  describe(`focus visible sur les éléments découpés — ${label}`, () => {
    it.each(CLIPPED)("%s : découpé, donc contour de focus dessiné à l'intérieur", (cls) => {
      const rules = cssRules(css()).filter((r) => r.at.length === 0);
      const selectors = (r: { prelude: string }) => r.prelude.split(",").map((s) => s.trim());
      // La classe est bien découpée (sinon ce test n'a plus lieu d'être).
      const clipped = rules.some(
        (r) => selectors(r).includes(cls) && declarations(r.body).some((d) => d.prop === "clip-path"),
      );
      expect(clipped, `${cls} n'a plus de clip-path`).toBe(true);
      // Et son :focus-visible décale le contour vers l'intérieur.
      const inward = rules.some(
        (r) =>
          selectors(r).includes(`${cls}:focus-visible`) &&
          declarations(r.body).some((d) => d.prop === "outline-offset" && /^-\d/.test(d.value)),
      );
      expect(inward, `${cls}:focus-visible sans outline-offset négatif`).toBe(true);
    });
  });
}

check("CSS source", () => readFileSync(GLOBALS_CSS, "utf8"));

let compiled = "";
beforeAll(async () => {
  compiled = await compileGlobalsCss();
}, 60_000);
check("CSS compilé (prod)", () => compiled);
