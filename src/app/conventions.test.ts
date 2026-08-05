// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";

import { DETAIL_ROUTES } from "@/lib/cache";

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

/** Source débarrassée de ses commentaires : on cherche du CODE, pas des mots. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

const files = appFiles(APP).map((file) => ({
  label: relative(APP, file).split(sep).join("/"),
  // Nom sans extension : "not-found.tsx" → "not-found".
  stem: basename(file).replace(/\.[^.]+$/, ""),
  code: stripComments(readFileSync(file, "utf8")),
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
    //
    // La route attrape-tout compte autant que la page 404 elle-même : c'est
    // elle qui l'atteint. Next réserve les URL inconnues au `not-found` RACINE,
    // et notre racine est un segment dynamique (`[locale]`) — sans attrape-tout,
    // `[locale]/not-found.tsx` existe mais n'est jamais servi aux visiteurs.
    const required = [
      join("[locale]", "not-found.tsx"),
      join("[locale]", "[...rest]", "page.tsx"),
      "global-error.tsx",
    ];
    const missing = required.filter((p) => !existsSync(join(APP, p)));
    expect(missing).toEqual([]);
  });

  it("invalide le cache avec le préfixe de langue, jamais sans", () => {
    // `revalidatePath("/equipes")` ne correspond à AUCUNE route depuis le
    // passage sous `[locale]` : les vraies adresses sont `/fr/equipes` et
    // `/en/equipes`. L'appel ne rafraîchissait donc plus rien, en silence — et
    // ça ne se voyait pas tant que les pages étaient en `force-dynamic`,
    // puisqu'il n'y avait aucun HTML en cache à invalider.
    //
    // Tout passe désormais par `revalidateLocalizedPath`, qui envoie le motif
    // `/[locale]/…` et couvre les deux langues d'un coup.
    const offenders = files
      .filter((f) => !/\.(test|spec)\.tsx?$/.test(f.label))
      .filter((f) => /\brevalidatePath\s*\(/.test(f.code))
      .map((f) => f.label);

    expect(offenders).toEqual([]);
  });

  it("déclare chaque page de détail publique dans DETAIL_ROUTES", () => {
    // Ces pages sont prégénérées (ISR) : si personne ne les invalide, une modif
    // du back-office reste invisible jusqu'à une heure. Le cas s'est produit —
    // la fiche d'un membre n'était rafraîchie par aucune action, alors que la
    // liste et la page du roster l'étaient.
    //
    // `DETAIL_ROUTES` est ce que le bouton « Rafraîchir le site » balaie :
    // toute nouvelle page à segment dynamique doit y entrer.
    const routes = files
      .filter((f) => f.stem === "page" && f.label.startsWith("[locale]/"))
      .map((f) => "/" + dirname(f.label).replace(/^\[locale\]\/?/, ""))
      .filter((r) => r.includes("[")) // seulement les routes à segment dynamique
      .filter((r) => !r.startsWith("/admin")) // le back-office n'est pas mis en cache
      .filter((r) => !r.includes("[...")); // l'attrape-tout 404 n'a rien à invalider

    const oubliees = routes.filter((r) => !DETAIL_ROUTES.includes(r as never));
    expect(oubliees).toEqual([]);
  });
});
