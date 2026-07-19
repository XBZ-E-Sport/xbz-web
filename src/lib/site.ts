// Configuration SEO / identité du site, centralisée.
// Le domaine de production se règle via NEXT_PUBLIC_SITE_URL (sinon fallback).

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
