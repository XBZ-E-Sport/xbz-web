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
 * Métadonnées d'une page dynamique : titre + description propres à la page,
 * plus l'Open Graph / Twitter / canonical assortis.
 *
 * Sans cet objet, une page qui ne définit que `title`/`description` hérite de
 * l'`openGraph` racine (titre générique) et du canonical racine ("/") — la
 * carte de partage afficherait alors le bon visuel mais un titre générique.
 * L'image OG, elle, vient du fichier `opengraph-image` du segment et se
 * superpose automatiquement (on ne définit pas `openGraph.images` ici).
 * Les chemins relatifs sont résolus en absolu via `metadataBase` (layout racine).
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string; // chemin relatif, ex "/actualite/mon-slug"
  ogType?: "website" | "article";
}): Metadata {
  const { title, description, path, ogType = "website" } = opts;
  const shared = { url: path, title, description, siteName: siteConfig.name, locale: siteConfig.locale };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph:
      ogType === "article"
        ? { type: "article", ...shared }
        : { type: "website", ...shared },
    twitter: { card: "summary_large_image", title, description },
  };
}
