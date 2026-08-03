// Configuration SEO / identité du site, centralisée.
// Le domaine de production se règle via NEXT_PUBLIC_SITE_URL (sinon fallback).

import type { Metadata } from "next";

export const siteConfig = {
  name: "XBZ Esport",
  shortName: "XBZ",
  description:
    "XBZ Esport — structure esport compétitive sur Rocket League. Rejoins une équipe motivée, sérieuse et ambitieuse.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://xbz-esport.fr").replace(/\/$/, ""),
  locale: "fr_FR",
  discord: process.env.NEXT_PUBLIC_DISCORD_URL ?? "",
} as const;

/** URL absolue à partir d'un chemin relatif (pour l'OG, le sitemap, le JSON-LD). */
export function absoluteUrl(path = "/"): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Chemin d'une page dans une langue donnée.
 *
 * Les deux langues sont préfixées (`localePrefix: "always"` dans
 * `src/i18n/routing.ts`) : `/fr/equipes` et `/en/equipes`. La racine d'une
 * langue est `/fr`, pas `/fr/`.
 */
export function localizedPath(path: string, locale: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Codes Open Graph par langue (`og:locale` attend une variante régionale). */
const OG_LOCALES: Record<string, string> = { fr: "fr_FR", en: "en_US" };

/**
 * Métadonnées d'une page : titre + description propres à la page, plus
 * l'Open Graph / Twitter / canonical assortis, et le hreflang des deux langues.
 *
 * Sans cet objet, une page qui ne définit que `title`/`description` hérite de
 * l'`openGraph` racine (titre générique) et du canonical racine ("/") — la
 * carte de partage afficherait alors le bon visuel mais un titre générique.
 * L'image OG, elle, vient du fichier `opengraph-image` du segment et se
 * superpose automatiquement (on ne définit pas `openGraph.images` ici).
 * Les chemins relatifs sont résolus en absolu via `metadataBase` (layout racine).
 *
 * `path` est TOUJOURS le chemin non préfixé (ex. "/equipes") : le préfixe de
 * langue est ajouté ici, pour que canonical et hreflang restent cohérents.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string; // chemin relatif SANS préfixe de langue, ex "/actualite/mon-slug"
  locale?: string;
  ogType?: "website" | "article";
}): Metadata {
  const { title, description, path, locale = "fr", ogType = "website" } = opts;
  const canonical = localizedPath(path, locale);
  const shared = {
    url: canonical,
    title,
    description,
    siteName: siteConfig.name,
    locale: OG_LOCALES[locale] ?? siteConfig.locale,
  };
  return {
    title,
    description,
    alternates: {
      canonical,
      // hreflang : dit à Google que ces deux URL sont la même page, en deux langues.
      languages: { fr: localizedPath(path, "fr"), en: localizedPath(path, "en") },
    },
    openGraph:
      ogType === "article"
        ? { type: "article", ...shared }
        : { type: "website", ...shared },
    twitter: { card: "summary_large_image", title, description },
  };
}
