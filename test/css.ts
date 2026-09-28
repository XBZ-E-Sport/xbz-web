// Helpers de test CSS : compile globals.css EXACTEMENT comme `next build`
// (Tailwind v4 + optimisation Lightning CSS minifiée) et découpe une feuille en
// règles, avec leurs règles @ englobantes.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const ROOT = process.cwd();
export const GLOBALS_CSS = join(ROOT, "src", "app", "[locale]", "globals.css");

/** Le CSS réellement servi en prod pour globals.css. */
export async function compileGlobalsCss(): Promise<string> {
  const source = readFileSync(GLOBALS_CSS, "utf8");
  const result = await postcss([tailwind({ base: ROOT, optimize: { minify: true } })]).process(source, {
    from: GLOBALS_CSS,
  });
  return result.css;
}

export type CssRule = { prelude: string; body: string; at: string[] };

/**
 * Règles `prélude { corps }` d'une feuille, commentaires retirés, en descendant
 * dans les règles @ à blocs (@media, @supports, @layer…). Les @keyframes sont
 * gardées entières (leurs étapes restent dans le corps).
 */
export function cssRules(css: string, at: string[] = []): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const out: CssRule[] = [];
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
    const body = src.slice(open + 1, close - 1);
    if (prelude.startsWith("@") && !prelude.startsWith("@keyframes")) out.push(...cssRules(body, [...at, prelude]));
    else out.push({ prelude, body, at });
    i = close;
  }
  return out;
}

/** Déclarations `propriété: valeur` d'un corps de règle (hors blocs imbriqués). */
export function declarations(body: string): { prop: string; value: string }[] {
  return [...body.replace(/\{[^}]*\}/g, " ").matchAll(/(?:^|;)\s*([a-z-]+)\s*:([^;]*)/g)].map((m) => ({
    prop: m[1],
    value: m[2].trim(),
  }));
}

/** Fichiers .tsx de src (hors tests), avec leur chemin lisible. */
export function sourceFiles(): { label: string; code: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
    });
  return walk(join(ROOT, "src")).map((file) => ({
    label: relative(ROOT, file).split(sep).join("/"),
    code: readFileSync(file, "utf8"),
  }));
}
