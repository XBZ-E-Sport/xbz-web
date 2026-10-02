// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { compileGlobalsCss } from "../../test/css";

/**
 * Garde-fou de la charte (rouge #dc2515, jaune #fccd05, neutres) :
 *
 * - aucune couleur bleue ou violette vive dans le code (le violet des badges
 *   boutique / rôles / staff et le bleu de « Communauté » étaient les derniers) ;
 *   les fonds quasi noirs à reflet bleuté (#0d0d13…) restent permis ;
 * - chaque classe des badges existe dans le CSS compilé (piège Tailwind : une
 *   classe posée dans le code mais jamais générée ne se voit qu'en prod).
 */

const ROOT = process.cwd();

function codeFiles(dir = join(ROOT, "src")): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return codeFiles(full);
    return /\.(?:tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Teinte (°), saturation et luminosité (0–1) d'une couleur RGB. */
function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r / 255) h = 60 * ((((g - b) / 255 / d) % 6) + 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else h = 60 * ((r - g) / 255 / d + 4);
  }
  return { h: h % 360, s: max ? d / max : 0, v: max };
}

/** Bleu, indigo, violet, magenta vifs : hors charte. */
const offBrand = ({ h, s, v }: ReturnType<typeof hsv>) => h >= 180 && h <= 330 && s > 0.2 && v > 0.35;

describe("charte — pas de bleu ni de violet", () => {
  it("aucune couleur bleue ou violette vive dans le code source", () => {
    const offenders: string[] = [];
    for (const file of codeFiles()) {
      const code = readFileSync(file, "utf8");
      const label = relative(ROOT, file).split(sep).join("/");
      for (const m of code.matchAll(/#([0-9a-f]{6})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
        const [r, g, b] = m[1]
          ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
          : [m[2], m[3], m[4]].map(Number);
        if (offBrand(hsv(r, g, b))) offenders.push(`${label} : ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("le détecteur reconnaît bien l'ancien violet et l'ancien bleu, pas les fonds sombres", () => {
    expect(offBrand(hsv(160, 90, 255))).toBe(true); // violet des badges
    expect(offBrand(hsv(0xb6, 0xbd, 0xff))).toBe(true); // bleu « Communauté »
    expect(offBrand(hsv(0xdc, 0x25, 0x15))).toBe(false); // rouge charte
    expect(offBrand(hsv(0xfc, 0xcd, 0x05))).toBe(false); // jaune charte
    expect(offBrand(hsv(0x0d, 0x0d, 0x13))).toBe(false); // fond quasi noir
  });
});

// Fichiers qui définissent des badges (tables `Clé: "classes"`).
const BADGE_FILES = [
  "src/lib/format.ts",
  "src/components/PlayerCard.tsx",
  "src/app/[locale]/equipes/page.tsx",
];

describe("charte — badges compilés (prod)", () => {
  let css = "";
  beforeAll(async () => {
    css = await compileGlobalsCss();
  }, 60_000);

  it.each(BADGE_FILES)("%s : chaque classe de couleur des badges existe dans le CSS compilé", (file) => {
    const code = readFileSync(join(ROOT, file), "utf8");
    const tokens = new Set(
      [...code.matchAll(/^\s*[\p{L}\w]+: "([^"]+)",?$/gmu)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((t) => /^(?:bg|text|ring|shadow|from|to)-/.test(t)),
    );
    expect(tokens.size, file).toBeGreaterThan(0);
    const missing = [...tokens].filter((t) => {
      const selector = `.${t.replace(/[^\w-]/g, (c) => `\\${c}`)}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return !new RegExp(`${selector}(?=[{,:\\s>+~\\[])`).test(css);
    });
    expect(missing, file).toEqual([]);
  });
});
