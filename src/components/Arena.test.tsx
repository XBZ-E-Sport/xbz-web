// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

import Arena from "@/components/Arena";

/**
 * Garde-fou de la couche d'ambiance « Arène » (fond animé, 100 % CSS).
 *
 * Ses règles ne se voient qu'à l'œil, sur un vrai téléphone : ce test les fige.
 * - Pas de filter/blur : sur GPU mobile, la région d'un filtre est rognée à la
 *   boîte de l'élément → un « carré » visible (déjà vécu derrière le corbeau).
 * - On n'anime que transform/opacity (compositeur : ni layout ni paint).
 * - Aucun translate:/rotate:/scale: dans le même bloc qu'un transform :
 *   Lightning CSS (build de prod) les fusionne ou les supprime, sans bruit.
 * - Mouvement réduit : bande retirée, éclats IMMOBILES mais visibles. Masquée à
 *   l'impression, en contraste forcé/renforcé et dans le back-office.
 * - Et surtout : vérifié sur le CSS COMPILÉ comme en prod (Tailwind + Lightning
 *   CSS), pas seulement sur la source — le piège « classe présente dans le
 *   HTML, absente du CSS » ne se voit qu'à cet endroit.
 */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const CSS_PATH = join(process.cwd(), "src", "app", "[locale]", "globals.css");
const source = readFileSync(CSS_PATH, "utf8");

type Block = { prelude: string; body: string; at: string[] };

/**
 * Découpe un CSS en blocs `prélude { corps }`, commentaires retirés, en
 * descendant dans toutes les règles @ à blocs (@media, @supports, @layer…) sauf
 * @keyframes, gardée entière (ses étapes sont dans son corps).
 */
function blocks(css: string, at: string[] = []): Block[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const out: Block[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) break;
    let depth = 1;
    let close = open + 1;
    for (; close < src.length && depth > 0; close++) {
      if (src[close] === "{") depth++;
      else if (src[close] === "}") depth--;
    }
    // Le prélude commence après la dernière instruction (`@import …;`).
    const prelude = src.slice(i, open).split(";").pop()!.trim();
    const body = src.slice(open + 1, close - 1);
    if (prelude.startsWith("@") && !prelude.startsWith("@keyframes")) {
      out.push(...blocks(body, [...at, prelude]));
    } else out.push({ prelude, body, at });
    i = close;
  }
  return out;
}

/** Déclarations `propriété: valeur` d'un corps (hors blocs imbriqués). */
const decls = (body: string) =>
  [...body.replace(/\{[^}]*\}/g, " ").matchAll(/(?:^|;)\s*([a-z-]+)\s*:([^;]*)/g)].map((m) => ({
    prop: m[1],
    value: m[2].trim(),
  }));
const has = (b: Block, prop: string, value?: RegExp) =>
  decls(b.body).some((d) => d.prop === prop && (!value || value.test(d.value)));

// Tout ce qui peut refaire un « carré » ou coûter cher au GPU mobile.
const FORBIDDEN_PROPS =
  /^(?:-webkit-)?(?:backdrop-)?filter$|^mix-blend-mode$|^will-change$|^(?:-webkit-)?mask(?:-image)?$/;
const FORBIDDEN_VALUES = /blur\(|drop-shadow\(/;

/** Vue « arène » d'une feuille : règles, keyframes animées par elles. */
function arenaOf(css: string) {
  const all = blocks(css);
  const rules = all.filter((b) => b.prelude.includes(".xbz-arena"));
  const declared = new Map(
    all.filter((b) => b.prelude.startsWith("@keyframes ")).map((b) => [b.prelude.slice(11).trim(), b]),
  );
  // Toute keyframe citée par une animation de la couche, quel que soit son nom.
  const used = new Set<string>();
  for (const r of rules) {
    for (const d of decls(r.body)) {
      if (d.prop !== "animation" && d.prop !== "animation-name") continue;
      for (const token of d.value.split(/[\s,]+/)) if (declared.has(token)) used.add(token);
    }
  }
  const keyframes = [...used].map((name) => declared.get(name)!);
  return { all, rules, declared, keyframes };
}

/** Balises et attributs posés par <Arena /> (rendu serveur, comme en prod). */
const markup = renderToStaticMarkup(<Arena />);
const nodes = [...markup.matchAll(/<([a-z]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/g)].map((m) => ({
  tag: m[1],
  attrs: Object.fromEntries([...m[2].matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
}));
const arenaRoot = nodes[0];
const classes = [...new Set(nodes.flatMap((n) => (n.attrs.class ?? "").split(/\s+/).filter(Boolean)))];

function checkSheet(label: string, css: () => string) {
  describe(`couche Arène — ${label}`, () => {
    let a: ReturnType<typeof arenaOf>;
    beforeAll(() => {
      a = arenaOf(css());
    });
    const base = (selector: string) => a.rules.find((b) => b.prelude === selector && b.at.length === 0);

    it("pose la couche fixe, sous le contenu, non cliquable", () => {
      const root = base(".xbz-arena");
      expect(root).toBeDefined();
      expect(has(root!, "position", /^fixed$/)).toBe(true);
      expect(has(root!, "z-index", /^-1$/)).toBe(true);
      expect(has(root!, "pointer-events", /^none$/)).toBe(true);
      expect(has(root!, "overflow", /^hidden$/)).toBe(true);
      expect(has(root!, "contain", /^strict$/)).toBe(true);
    });

    it("isole le body (sinon z-index -1 passerait sous son fond)", () => {
      const body = a.all.find((b) => b.prelude === "body" && b.at.length === 0 && has(b, "isolation"));
      expect(body && has(body, "isolation", /^isolate$/)).toBe(true);
    });

    it("n'utilise ni filter, ni blur, ni blend, ni masque, ni will-change", () => {
      const offenders = [...a.rules, ...a.keyframes].filter((b) =>
        decls(b.body).some((d) => FORBIDDEN_PROPS.test(d.prop) || FORBIDDEN_VALUES.test(d.value)),
      );
      expect(offenders.map((b) => b.prelude)).toEqual([]);
    });

    it("anime seulement transform/opacity, keyframes présentes et sans var()", () => {
      expect([...a.declared.keys()]).toEqual(
        expect.arrayContaining(["xbz-arena-sweep", "xbz-arena-drift", "xbz-arena-glint"]),
      );
      expect(a.keyframes.length).toBeGreaterThanOrEqual(3);
      for (const k of a.keyframes) {
        const frames = [...k.body.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
        const animated = new Set(frames.flatMap((f) => decls(f).map((d) => d.prop)));
        expect([...animated].filter((p) => p !== "transform" && p !== "opacity"), k.prelude).toEqual([]);
        expect(k.body, k.prelude).not.toContain("var(");
      }
    });

    it("ne mélange jamais transform et translate/rotate/scale dans un même bloc", () => {
      const offenders = a.rules.filter((b) => {
        const p = decls(b.body).map((d) => d.prop);
        return p.includes("transform") && p.some((x) => x === "translate" || x === "rotate" || x === "scale");
      });
      expect(offenders.map((b) => b.prelude)).toEqual([]);
    });

    it("dessine chaque élément posé par <Arena /> (le piège « classe sans CSS »)", () => {
      for (const cls of classes) {
        // Une règle de base qui fait plus que masquer : une règle @media qui se
        // contente de cacher un éclat ne suffit pas à le dessiner.
        const drawn = a.rules.some(
          (b) =>
            b.at.length === 0 &&
            b.prelude.split(",").some((s) => s.trim() === `.${cls}`) &&
            decls(b.body).some((d) => !["display", "visibility"].includes(d.prop)),
        );
        expect(drawn, cls).toBe(true);
      }
      // La bande et chaque éclat ont bien une image.
      expect(has(base(".xbz-arena__sweep")!, "background", /data:image\/svg\+xml/)).toBe(true);
      for (const cls of classes.filter((c) => /^xbz-arena__shard--\d+$/.test(c))) {
        expect(has(base(`.${cls}`)!, "background-image", /var\(--xbz-arena-shard-|data:image/), cls).toBe(true);
      }
      // Un élément masqué par défaut doit être ré-affiché quelque part.
      for (const cls of classes) {
        const rule = base(`.${cls}`);
        if (!rule || !has(rule, "display", /^none$/)) continue;
        const shown = a.rules.some(
          (b) => b.at.length > 0 && b.prelude === `.${cls}` && has(b, "display", /^(?!none$)/),
        );
        expect(shown, `${cls} jamais ré-affiché`).toBe(true);
      }
      expect(has(base(".xbz-arena__sweep")!, "display", /^none$/)).toBe(false);
    });

    it("mouvement réduit : bande retirée, éclats figés mais toujours visibles", () => {
      const reduced = (b: Block) => b.at.some((m) => /prefers-reduced-motion:\s*reduce/.test(m));
      const sweep = a.rules.find((b) => reduced(b) && b.prelude === ".xbz-arena__sweep" && has(b, "display", /^none$/));
      expect(sweep).toBeDefined();
      const still = a.rules.findIndex((b) => reduced(b) && b.prelude === ".xbz-arena__shard" && has(b, "animation", /^none$/));
      expect(still).toBeGreaterThanOrEqual(0);
      // Le décor reste : rien ne masque la couche ni les éclats dans ce mode.
      const hidden = a.rules.filter(
        (b) =>
          reduced(b) &&
          /\.xbz-arena(?:__shard)?(?![\w-])/.test(b.prelude) &&
          (has(b, "display", /^none$/) || has(b, "visibility", /^hidden$/)),
      );
      expect(hidden.map((b) => b.prelude)).toEqual([]);
      // Et aucune règle placée APRÈS ne relance une animation d'éclat.
      const relaunch = a.rules
        .slice(still + 1)
        .filter((b) => /\.xbz-arena__shard/.test(b.prelude) && (has(b, "animation") || has(b, "animation-name")));
      expect(relaunch.map((b) => b.prelude)).toEqual([]);
    });

    it.each([
      ["impression", /\bprint\b/],
      ["contraste forcé", /forced-colors:\s*active/],
      ["contraste renforcé", /prefers-contrast:\s*more/],
    ])("se masque : %s", (_label, query) => {
      const rule = a.rules.find(
        (b) => b.prelude === ".xbz-arena" && b.at.some((m) => query.test(m)) && has(b, "display", /^none$/),
      );
      expect(rule).toBeDefined();
    });

    it("se masque dans le back-office (marqueur data-admin)", () => {
      const rule = a.rules.find((b) => /^body:has\(\[data-admin\]\)\s*\.xbz-arena$/.test(b.prelude));
      expect(rule && has(rule, "display", /^none$/)).toBe(true);
    });
  });
}

// 1) La source telle qu'écrite.
checkSheet("CSS source", () => source);

// 2) Le CSS réellement servi : même chaîne que `next build` (Tailwind v4 +
//    optimisation Lightning CSS minifiée).
let compiled = "";
beforeAll(async () => {
  const result = await postcss([tailwind({ base: process.cwd(), optimize: { minify: true } })]).process(source, {
    from: CSS_PATH,
  });
  compiled = result.css;
}, 60_000);
checkSheet("CSS compilé (prod)", () => compiled);

describe("couche Arène — CSS compilé : Lightning CSS n'a rien fusionné", () => {
  it("garde les rotate:/scale: statiques des éclats", () => {
    const src = arenaOf(source).rules.filter((b) => b.at.length === 0);
    const out = arenaOf(compiled).rules.filter((b) => b.at.length === 0);
    for (const rule of src) {
      for (const prop of ["rotate", "scale"]) {
        if (!has(rule, prop)) continue;
        const twin = out.find((b) => b.prelude === rule.prelude && has(b, prop));
        expect(twin, `${rule.prelude} { ${prop} }`).toBeDefined();
      }
    }
  });
});

describe("couche Arène — markup", () => {
  it("est rendue par le layout, avant le contenu", () => {
    const layout = read("src", "app", "[locale]", "layout.tsx");
    expect(layout).toMatch(/import Arena from "@\/components\/Arena"/);
    expect(layout).toMatch(/<body[^>]*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<Arena \/>/);
  });

  it("porte le marqueur data-admin sur la racine du back-office", () => {
    expect(read("src", "app", "[locale]", "admin", "layout.tsx")).toMatch(/<div\s+data-admin\b/);
  });

  it("est décorative : aria-hidden, rien de focusable, aucun style en ligne", () => {
    expect(markup.startsWith("<div")).toBe(true);
    expect(arenaRoot.attrs.class).toBe("xbz-arena");
    expect(arenaRoot.attrs["aria-hidden"]).toBe("true");
    expect(nodes.length).toBeGreaterThan(5);
    // Toute balise du markup est lue : aucun élément ne peut échapper au contrôle.
    expect(nodes.length).toBe((markup.match(/<[a-z]/g) ?? []).length);
    const focusable = nodes.filter(
      (n) => ["a", "button", "input", "select", "textarea"].includes(n.tag) || "tabindex" in n.attrs,
    );
    expect(focusable).toHaveLength(0);
    expect(nodes.filter((n) => "style" in n.attrs)).toHaveLength(0);
  });
});
