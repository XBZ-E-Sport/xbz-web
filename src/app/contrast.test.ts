// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { GLOBALS_CSS } from "../../test/css";

/**
 * Contrastes WCAG 2.2 AA du site (texte 4,5:1, grands textes et contours de
 * composants 3:1), mesurés par l'audit d'accessibilité sur les fonds RÉELS :
 *
 * - le rouge primaire #dc2515 en texte (titres des cartes) tombait à 3,2–3,6:1
 *   → textes en rouge clair (`xbz-red-light`) ;
 * - un texte sombre sur un dégradé finissant en rouge primaire (badge
 *   « Capitaine », filtres actifs, « Recrutement ouvert ») : 4,2–4,3:1 ;
 * - « Recrutement ouvert » pulsait sans fin (~2,3:1 au creux, et impossible à
 *   arrêter : WCAG 2.2.2) ;
 * - les champs de formulaire n'avaient aucun contour (1,09:1).
 */

const ROOT = process.cwd();

/** Luminance relative WCAG d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function token(name: string): string {
  const m = readFileSync(GLOBALS_CSS, "utf8").match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --color-${name} introuvable`);
  return m[1].toLowerCase();
}

// Fonds mesurés par l'audit (pixels réels sous le texte).
const PAGE = "#0a0a0a";
const CARD = "#1c1a1c"; // carte au repos
const CARD_LIGHTEST = "#2a2729"; // carte survolée, sous le halo rouge (pire cas, avec marge)
const INPUT = "#111111";
// Gris Tailwind v4 (oklch → hex) utilisés ici.
const NEUTRAL_400 = "#a1a1a1";
const NEUTRAL_500 = "#737373";

describe("contrastes — couleurs de la charte sur les fonds réels", () => {
  const red = token("xbz-blue");
  const redLight = token("xbz-red-light");
  const yellow = token("xbz-cyan");

  it("le rouge CLAIR tient l'AA (4,5:1) en texte, même sur la carte la plus claire", () => {
    expect(ratio(redLight, CARD_LIGHTEST)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(redLight, PAGE)).toBeGreaterThanOrEqual(4.5);
  });

  it("le rouge primaire, lui, ne l'atteint PAS sur les cartes (d'où le rouge clair)", () => {
    expect(ratio(red, CARD_LIGHTEST)).toBeLessThan(4.5);
    // …mais suffit aux très grands textes (3:1) : le « 404 » géant le garde.
    expect(ratio(red, PAGE)).toBeGreaterThanOrEqual(3);
  });

  it("un texte sombre tient l'AA sur toute la longueur des dégradés (jaune → rouge clair, saumon → rouge clair)", () => {
    for (const ink of ["#231a17", "#111111"]) {
      for (const stop of [yellow, redLight, "#f4a79b"]) {
        expect(ratio(ink, stop), `${ink} sur ${stop}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("le « vs » des matchs (neutral-400) tient l'AA sur les cartes", () => {
    expect(ratio(NEUTRAL_400, CARD_LIGHTEST)).toBeGreaterThanOrEqual(4.5);
  });

  it("le contour des champs (neutral-500) se distingue à 3:1 du champ et de la carte", () => {
    expect(ratio(NEUTRAL_500, INPUT)).toBeGreaterThanOrEqual(3);
    expect(ratio(NEUTRAL_500, CARD)).toBeGreaterThanOrEqual(3);
  });
});

// --- Garde-fous sur le code du site public -----------------------------------

function publicFiles(dir = join(ROOT, "src")): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "admin" ? [] : publicFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}
const sources = publicFiles().map((file) => ({
  label: relative(ROOT, file).split(sep).join("/"),
  code: readFileSync(file, "utf8"),
}));
/** Chaînes de classes (entre guillemets ou backticks) d'un fichier. */
const classStrings = (code: string) => [...code.matchAll(/(["'`])([^"'`\n]*?)\1/g)].map((m) => m[2]);

describe("contrastes — garde-fous du code public", () => {
  it("pas de rouge primaire en couleur de texte (sauf le « 404 » géant, grand texte)", () => {
    const allowed = new Set(["src/app/[locale]/not-found.tsx"]);
    const offenders = sources
      .filter((f) => !allowed.has(f.label) && /(?<![\w-])text-xbz-blue\b/.test(f.code))
      .map((f) => f.label);
    expect(offenders).toEqual([]);
  });

  it("pas de texte sombre sur un dégradé qui finit en rouge primaire", () => {
    const offenders = sources.flatMap((f) =>
      classStrings(f.code)
        .filter((c) => /\b(?:from|via|to)-xbz-blue\b/.test(c) && /text-\[#(?:111|231a17)\]/.test(c))
        .map((c) => `${f.label} : ${c}`),
    );
    expect(offenders).toEqual([]);
  });

  it("aucune pulsation qui ne s'arrête pas en mouvement réduit", () => {
    const offenders = sources.flatMap((f) =>
      classStrings(f.code)
        .filter((c) => /(?:^|\s)animate-pulse\b/.test(c))
        .map((c) => `${f.label} : ${c}`),
    );
    expect(offenders).toEqual([]);
  });

  it("chaque champ de formulaire public a un contour visible", () => {
    const offenders = sources.flatMap((f) =>
      classStrings(f.code)
        .filter((c) => /bg-\[#111\]/.test(c) && /\bborder-0\b/.test(c))
        .map((c) => `${f.label} : ${c}`),
    );
    expect(offenders).toEqual([]);
  });
});
