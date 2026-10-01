// Pages de liste qui peuvent être vides (aucun partenaire, aucun match, aucun
// média) : la page elle-même et le sitemap posent la même question ici.
//
// Vide, une page n'affiche qu'un « bientôt disponible » : une page pauvre aux
// yeux de Google, qui pèse sur l'ensemble du site. Elle sort donc de l'index
// (`noindex`) et du sitemap, et y revient d'elle-même dès qu'elle se remplit
// (les lectures sont mises en cache et invalidées par le back-office).

import { getMatchBoards } from "@/lib/matchs";
import { getMedias } from "@/lib/medias";
import { getPartners } from "@/lib/partenaires";
import { routing } from "@/i18n/routing";

const checks = {
  // Le nombre de partenaires ne dépend pas de la langue (seuls les textes changent).
  "/partenaires": async () => (await getPartners(routing.defaultLocale)).length === 0,
  "/calendrier": async () => {
    const { upcoming, results } = await getMatchBoards();
    return upcoming.length + results.length === 0;
  },
  "/galerie": async () => (await getMedias()).length === 0,
} satisfies Record<string, () => Promise<boolean>>;

export type ListPagePath = keyof typeof checks;

/** La page de liste `path` est-elle vide ? */
export function isEmptyListPage(path: ListPagePath): Promise<boolean> {
  return checks[path]();
}

/** Chemins (non préfixés) des pages de liste actuellement vides. */
export async function emptyListPages(): Promise<Set<string>> {
  const paths = Object.keys(checks) as ListPagePath[];
  const empty = await Promise.all(paths.map((p) => checks[p]()));
  return new Set(paths.filter((_, i) => empty[i]));
}
