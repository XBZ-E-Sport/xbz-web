// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/**
 * Garde-fou : chaque classe d'animation posée dans le code EXISTE dans le CSS
 * compilé comme en prod (Tailwind v4 + Lightning CSS).
 *
 * Le piège, déjà vécu : `motion-safe:animate-raven-float` était écrite dans le
 * JSX, mais `.animate-raven-float` était une classe CSS simple — Tailwind ne lui
 * applique pas de variante, la règle n'était jamais générée et le corbeau ne
 * bougeait pas. Rien ne le signalait : ni le build, ni la console.
 *
 * Et une règle mobile : un élément animé ne porte jamais de filtre (ombre,
 * flou). Sur GPU mobile, un filtre sur une couche animée est appliqué par le
 * compositeur, qui peut rogner sa région à la boîte → un « carré » visible.
 * L'animation se pose sur un wrapper, le filtre sur l'enfant statique.
 */

const ROOT = process.cwd();
const CSS_PATH = join(ROOT, "src", "app", "[locale]", "globals.css");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });
}
const files = sources(join(ROOT, "src")).map((file) => ({
  label: relative(ROOT, file).split(sep).join("/"),
  code: readFileSync(file, "utf8"),
}));

/** Valeurs de className (chaînes et gabarits), une par attribut. */
const classNames = files.flatMap((f) =>
  [...f.code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => ({
    file: f.label,
    value: m[1] ?? m[2],
  })),
);

// Jetons d'animation Tailwind, variantes comprises (motion-safe:animate-pulse…).
const ANIMATE = /(?:^|[\s"'`])((?:[a-z0-9-]+:)*animate-[a-z0-9-]+)(?=[\s"'`]|$)/g;
const animated = classNames.filter((c) => [...c.value.matchAll(ANIMATE)].length > 0);
const tokens = [...new Set(classNames.flatMap((c) => [...c.value.matchAll(ANIMATE)].map((m) => m[1])))];

type Rule = { selector: string; at: string[] };

/** Règles d'une feuille (sélecteur + règles @ englobantes), sans les @keyframes. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const walk = (src: string, at: string[]) => {
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
      const prelude = src.slice(i, open).split(";").pop()!.trim();
      if (prelude.startsWith("@keyframes")) {
        // étapes d'animation : pas des règles de sélecteurs
      } else if (prelude.startsWith("@")) walk(src.slice(open + 1, close - 1), [...at, prelude]);
      else out.push({ selector: prelude, at });
      i = close;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, " "), []);
  return out;
}

/** Sélecteur CSS d'une classe Tailwind (`motion-safe:x` → `.motion-safe\:x`). */
const selectorOf = (token: string) => `.${token.replace(/:/g, "\\:")}`;

let compiled: Rule[] = [];
beforeAll(async () => {
  const source = readFileSync(CSS_PATH, "utf8");
  const result = await postcss([tailwind({ base: ROOT, optimize: { minify: true } })]).process(source, {
    from: CSS_PATH,
  });
  compiled = rules(result.css);
}, 60_000);

describe("classes d'animation", () => {
  it("en trouve dans le code (sinon ce test ne protège rien)", () => {
    expect(tokens.length).toBeGreaterThan(3);
    expect(tokens).toContain("motion-safe:animate-raven-float");
  });

  it("chaque classe d'animation du code a sa règle dans le CSS compilé", () => {
    const missing = tokens.filter(
      (t) => !compiled.some((r) => r.selector.split(",").some((s) => s.trim() === selectorOf(t))),
    );
    expect(missing).toEqual([]);
  });

  it("les variantes motion-safe sont bien coupées par prefers-reduced-motion", () => {
    for (const t of tokens.filter((x) => x.startsWith("motion-safe:"))) {
      const rule = compiled.find((r) => r.selector.split(",").some((s) => s.trim() === selectorOf(t)));
      expect(rule?.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a)), t).toBe(true);
    }
  });

  it("aucun élément animé ne porte de filtre (le « carré » sur GPU mobile)", () => {
    const offenders = animated.filter((c) =>
      /(?:^|[\s:])(?:drop-shadow|blur|backdrop-blur|filter|brightness|contrast|saturate)(?:-|\[|\s|$)/.test(c.value),
    );
    expect(offenders.map((c) => `${c.file} : ${c.value}`)).toEqual([]);
  });
});
