// @vitest-environment node
import { describe, it, expect } from "vitest";

import { sourceFiles } from "../../test/css";

/**
 * Images : ce qui se voit sur toutes les pages (logo) ou au-dessus de la ligne
 * de flottaison (corbeau) est servi au bon format et mis en cache.
 */

// Commentaires de bloc retirés (pas les `//` : ils apparaissent dans des URL).
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, " ");
const files = sourceFiles().map((f) => ({ ...f, code: strip(f.code) }));

/** Balises <Image …> (attributs compris) d'un fichier. */
const images = (code: string) => [...code.matchAll(/<Image\b[\s\S]*?\/>/g)].map((m) => m[0]);

describe("images", () => {
  it("plus de `priority` (déprécié en Next 16 : `preload`, ou `loading=\"eager\"`)", () => {
    const offenders = files.filter((f) => images(f.code).some((tag) => /\spriority\b/.test(tag))).map((f) => f.label);
    expect(offenders).toEqual([]);
  });

  it("les images de la marque passent par l'import statique (cache immutable)", () => {
    const offenders = files
      .filter((f) => /src="\/(?:logo-xbz[\w-]*|corbeau)\.png"/.test(f.code))
      .map((f) => f.label);
    expect(offenders).toEqual([]);
  });

  it("le logo est demandé à sa taille d'affichage, pas à celle du fichier (610 px)", () => {
    const logos = files.flatMap((f) => images(f.code).filter((tag) => /src=\{logoWide\}/.test(tag)));
    expect(logos.length).toBeGreaterThanOrEqual(2);
    for (const tag of logos) {
      const width = Number(tag.match(/width=\{(\d+)\}/)?.[1]);
      expect(width, tag).toBeGreaterThan(0);
      expect(width, tag).toBeLessThanOrEqual(160);
    }
  });
});
