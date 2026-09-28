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

  it("n'a aucun loading.tsx sur le site public (sinon les 404 répondent 200)", () => {
    // Un `loading.tsx` fait envoyer la page en flux : le statut HTTP part en 200
    // avant que la page sache si elle existe, et `notFound()` ne peut plus le
    // changer (doc Next : file-conventions/loading.md, « Status Codes »). Le
    // `loading.tsx` racine transformait ainsi chaque adresse inconnue — article,
    // membre, offre expirée — en « 200 OK ». Seul le back-office en garde un.
    const offenders = files
      .filter((f) => f.stem === "loading")
      .filter((f) => !f.label.startsWith("[locale]/admin/"))
      .map((f) => f.label);

    expect(offenders).toEqual([]);
  });
});

describe("composants partagés : la langue vient des props", () => {
  // Une page `force-static` rend ses composants SANS contexte de langue : un
  // hook (`useTranslations`, `useLocale`…) ou un `<Link>` sans `locale` y
  // retombe sur le français. C'est ce qui affichait « Capitaine » et des liens
  // /fr/… sur les pages /en des équipes. Les composants CLIENT, eux, sont sous
  // le NextIntlClientProvider de la bonne langue : ils ne sont pas concernés.
  const COMPONENTS = join(process.cwd(), "src", "components");
  const serverComponents = readdirSync(COMPONENTS)
    .filter((f) => f.endsWith(".tsx") && !/\.test\.tsx$/.test(f))
    .map((f) => ({ label: `components/${f}`, source: readFileSync(join(COMPONENTS, f), "utf8") }))
    .filter((f) => !/^\s*["']use client["']/.test(f.source))
    .map((f) => ({ ...f, code: stripComments(f.source) }));

  it("aucun composant serveur ne lit la langue par un hook", () => {
    const offenders = serverComponents
      .filter((f) => /\b(useTranslations|useLocale|useFormatter|useNow|useTimeZone|useMessages)\s*\(/.test(f.code))
      .map((f) => f.label);
    expect(offenders).toEqual([]);
  });

  it("chaque <Link> d'un composant serveur reçoit explicitement sa langue", () => {
    const offenders = serverComponents
      .filter((f) => /from\s+["']@\/i18n\/navigation["']/.test(f.code))
      .flatMap((f) =>
        [...f.code.matchAll(/<Link\b([\s\S]*?)>/g)]
          .filter((m) => !/\blocale=/.test(m[1]))
          .map(() => f.label),
      );
    expect(offenders).toEqual([]);
  });
});
