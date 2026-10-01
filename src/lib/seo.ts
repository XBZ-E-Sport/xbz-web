// Aides SEO partagées par les pages : description de page et fil d'Ariane.

import { absoluteUrl, localizedPath } from "@/lib/site";
import { clamp, squash } from "@/lib/text";

/** En dessous, un texte ne décrit pas vraiment la page (« ze CM », « Competitive team. »). */
export const MIN_DESCRIPTION = 70;
/** Au-delà, Google tronque l'extrait de toute façon. */
export const MAX_DESCRIPTION = 160;

/**
 * Meta description d'une page : le premier texte assez riche parmi
 * `candidates` (résumé, premier paragraphe, bio…), coupé proprement ; sinon
 * `fallback`, une phrase-type qui décrit vraiment la page.
 *
 * Sans ça, des fiches avaient pour description « el discordos » ou une bio
 * avec ses retours à la ligne, et des articles sans résumé n'en avaient aucune.
 */
export function pageDescription(candidates: (string | null | undefined)[], fallback: string): string {
  for (const c of candidates) {
    const text = squash(c ?? "");
    if (text.length >= MIN_DESCRIPTION) return clamp(text, MAX_DESCRIPTION);
  }
  return clamp(squash(fallback), MAX_DESCRIPTION);
}

/**
 * Fil d'Ariane schema.org (BreadcrumbList) : `items` du plus général au plus
 * précis, chemins SANS préfixe de langue (ajouté ici).
 */
export function breadcrumbJsonLd(items: { name: string; path: string }[], locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(localizedPath(item.path, locale)),
    })),
  };
}
