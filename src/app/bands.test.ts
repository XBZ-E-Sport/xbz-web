// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

import { GLOBALS_CSS, compileGlobalsCss, cssRules, declarations, sourceFiles, type CssRule } from "../../test/css";

/**
 * Garde-fou des bandes en biais (`.xbz-band`, séparateurs de sections).
 *
 * - Vérifié sur la source ET sur le CSS compilé comme en prod : le piège
 *   « classe posée dans le HTML, absente du CSS » ne se voit qu'une fois compilé.
 * - Pas de filtre ni de flou (sur GPU mobile, la région d'un filtre est rognée
 *   à la boîte → un « carré ») : la bande n'utilise que dégradés + clip-path.
 * - Fond et liseré sont des pseudo-éléments pleine largeur, SOUS le contenu
 *   (z-index -1 dans une bande isolée) : le contenu n'est jamais rogné.
 */

const FORBIDDEN_PROPS =
  /^(?:-webkit-)?(?:backdrop-)?filter$|^mix-blend-mode$|^will-change$|^(?:-webkit-)?mask(?:-image)?$/;
const FORBIDDEN_VALUES = /blur\(|drop-shadow\(/;

const uses = sourceFiles().filter((f) => /\bxbz-band\b/.test(f.code));

function checkSheet(label: string, css: () => string) {
  describe(`bandes en biais — ${label}`, () => {
    let rules: CssRule[] = [];
    beforeAll(() => {
      rules = cssRules(css()).filter((r) => r.prelude.includes(".xbz-band"));
    });
    const rule = (selector: string) => rules.find((r) => r.at.length === 0 && r.prelude.split(",").some((s) => s.trim() === selector));
    const has = (r: CssRule | undefined, prop: string, value?: RegExp) =>
      !!r && declarations(r.body).some((d) => d.prop === prop && (!value || value.test(d.value)));

    it("la bande est isolée et positionnée (ses pseudo-éléments restent SOUS son contenu)", () => {
      expect(has(rule(".xbz-band"), "position", /^relative$/)).toBe(true);
      expect(has(rule(".xbz-band"), "isolation", /^isolate$/)).toBe(true);
    });

    it("fond et liseré : pleine largeur, sous le contenu, découpés en biais", () => {
      for (const pseudo of [".xbz-band:before", ".xbz-band:after"]) {
        // Lightning CSS écrit `:before` ; la source, `::before`.
        const r = rules.find((x) => x.at.length === 0 && x.prelude.split(",").some((s) => s.trim().replace("::", ":") === pseudo));
        const all = rules.filter((x) => x.at.length === 0 && x.prelude.replace(/::/g, ":").includes(pseudo));
        const decl = all.flatMap((x) => declarations(x.body));
        expect(r, pseudo).toBeDefined();
        expect(decl.some((d) => d.prop === "z-index" && d.value === "-1"), pseudo).toBe(true);
        expect(decl.some((d) => d.prop === "inset" && /50vw/.test(d.value)), pseudo).toBe(true);
        expect(decl.some((d) => d.prop === "clip-path" && /^polygon\(/.test(d.value)), pseudo).toBe(true);
        expect(decl.some((d) => d.prop === "pointer-events" && d.value === "none"), pseudo).toBe(true);
      }
    });

    it("n'utilise ni filtre, ni flou, ni masque, ni will-change", () => {
      const offenders = rules.filter((r) =>
        declarations(r.body).some((d) => FORBIDDEN_PROPS.test(d.prop) || FORBIDDEN_VALUES.test(d.value)),
      );
      expect(offenders.map((r) => r.prelude)).toEqual([]);
    });
  });
}

checkSheet("CSS source", () => readFileSync(GLOBALS_CSS, "utf8"));

let compiled = "";
beforeAll(async () => {
  compiled = await compileGlobalsCss();
}, 60_000);
checkSheet("CSS compilé (prod)", () => compiled);

describe("bandes en biais — usage", () => {
  it("est posée sur des sections du site (sinon ce test ne protège rien)", () => {
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });

  it("chaque bande est une <section> sans filtre ni flou dans ses classes", () => {
    for (const f of uses) {
      for (const m of f.code.matchAll(/<(\w+)[^>]*className="([^"]*\bxbz-band\b[^"]*)"/g)) {
        expect(m[1], f.label).toBe("section");
        expect(m[2], f.label).not.toMatch(/(?:^|\s)(?:blur|backdrop-blur|drop-shadow|filter)(?:-|\s|$)/);
      }
    }
  });
});
