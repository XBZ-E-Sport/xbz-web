// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

/**
 * Garde-fou : les fichiers spéciaux de Next doivent porter leur nom EXACT.
 *
 * `not-found.tsx` sans son trait d'union devient un module ordinaire : Next ne
 * le voit plus, ne dit rien, et sert son 404 générique à la place du nôtre.
 * Même histoire pour `global-error.tsx` ou `opengraph-image.tsx`. C'est une
 * panne parfaitement silencieuse — rien au build, rien au runtime, juste un
 * écran par défaut à la place de celui qu'on a écrit.
 *
 * Ce test compare chaque nom de fichier à la liste officielle une fois les
 * traits d'union retirés : `notfound.tsx` ressemble alors à `not-found.tsx`
 * sans lui être égal, donc c'est un raté.
 */

const APP = join(process.cwd(), "src", "app");

// Fichiers spéciaux de Next 16 (routage + métadonnées) qui contiennent un
// trait d'union — les seuls exposés à cette faute de frappe.
const HYPHENATED = [
  "not-found",
  "global-error",
  "opengraph-image",
  "twitter-image",
  "apple-icon",
  "instrumentation-client",
];

const deHyphen = (name: string) => name.replace(/-/g, "");

function appFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? appFiles(full) : [full];
  });
}

const files = appFiles(APP).map((file) => ({
  label: relative(APP, file).split(sep).join("/"),
  // Nom sans extension : "not-found.tsx" → "not-found".
  stem: basename(file).replace(/\.[^.]+$/, ""),
}));

describe("conventions de fichiers dans src/app", () => {
  it("écrit les fichiers spéciaux avec leurs traits d'union", () => {
    const canonical = new Map(HYPHENATED.map((name) => [deHyphen(name), name]));
    const offenders = files
      .filter((f) => {
        const expected = canonical.get(deHyphen(f.stem));
        return expected !== undefined && f.stem !== expected;
      })
      .map((f) => `${f.label} → ${canonical.get(deHyphen(f.stem))}`);

    expect(offenders).toEqual([]);
  });

  it("garde les écrans de repli là où Next les cherche", () => {
    // Un 404 et un écran de crash : deux pages qu'on ne visite jamais en
    // développement, donc deux disparitions qu'on ne remarquerait pas.
    const required = [join("[locale]", "not-found.tsx"), "global-error.tsx"];
    const missing = required.filter((p) => !existsSync(join(APP, p)));
    expect(missing).toEqual([]);
  });
});
