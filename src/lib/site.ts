// Configuration SEO / identité du site, centralisée.
// Le domaine de production se règle via NEXT_PUBLIC_SITE_URL (sinon fallback).

import type { Metadata } from "next";

export const siteConfig = {
  name: "XBZ Esport",
  shortName: "XBZ",
  description:
    "XBZ Esport — structure esport compétitive sur Rocket League. Rejoins une équipe motivée, sérieuse et ambitieuse.",
  // Repli sur le domaine de PRODUCTION : si la variable venait à manquer sur
  // un environnement Vercel, canonicals, sitemap, JSON-LD et images Open Graph
  // pointeraient sinon vers une autre adresse — l'ancien repli était
  // `xbz-web.vercel.app`, un doublon du site aux yeux de Google.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.xbz-esport.org").replace(/\/$/, ""),
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

/**
 * hreflang d'une page : ses deux langues, plus `x-default` — la version servie
 * à un visiteur dont la langue n'est ni le français ni l'anglais (le français,
 * langue principale du club). Sans `x-default`, Google choisit seul.
 */
export function languageAlternates(path: string): Record<string, string> {
  return {
    fr: localizedPath(path, "fr"),
    en: localizedPath(path, "en"),
    "x-default": localizedPath(path, "fr"),
  };
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
  /** Date de publication (AAAA-MM-JJ) d'un article : `article:published_time`. */
  publishedTime?: string;
  /**
   * Page vide (aucun partenaire, aucun match…) : hors de l'index, mais ses
   * liens restent suivis. Une page « bientôt disponible » indexée est une page
   * pauvre aux yeux de Google ; elle revient d'elle-même quand elle se remplit.
   */
  noindex?: boolean;
}): Metadata {
  const { title, description, path, locale = "fr", ogType = "website", publishedTime, noindex = false } = opts;
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
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph:
      ogType === "article"
        ? { type: "article", ...shared, ...(publishedTime && { publishedTime }) }
        : { type: "website", ...shared },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}
