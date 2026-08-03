import type { MetadataRoute } from "next";

import { getArticles } from "@/lib/actualite";
import { getEquipesUrls } from "@/lib/equipes";
import { absoluteUrl, localizedPath } from "@/lib/site";
import { routing } from "@/i18n/routing";

// Généré à la demande : le sitemap lit la base (rosters/pôles/joueurs) → pas de
// dépendance BDD au build (cohérent avec les pages /equipes en force-dynamic).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Pages publiques principales (hors back-office).
  const routes: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/le-club", priority: 0.8, changeFrequency: "monthly" },
    { path: "/presentation", priority: 0.8, changeFrequency: "monthly" },
    { path: "/equipes", priority: 0.8, changeFrequency: "weekly" },
    { path: "/recrutement", priority: 0.9, changeFrequency: "weekly" },
    { path: "/actualite", priority: 0.7, changeFrequency: "weekly" },
    { path: "/boutique", priority: 0.6, changeFrequency: "monthly" },
    { path: "/support", priority: 0.5, changeFrequency: "monthly" },
    { path: "/mentions-legales", priority: 0.3, changeFrequency: "monthly" },
    { path: "/confidentialite", priority: 0.3, changeFrequency: "monthly" },
  ];

  /** URL absolue d'un chemin non préfixé, dans une langue donnée. */
  const url = (path: string, locale: string) => absoluteUrl(localizedPath(path, locale));

  /**
   * Une entrée par langue, chacune déclarant ses alternatives via `alternates`.
   * C'est ce qui dit à Google que `/fr/equipes` et `/en/equipes` sont la même
   * page en deux langues, au lieu de deux pages concurrentes.
   */
  const localized = (path: string) => ({
    languages: Object.fromEntries(routing.locales.map((l) => [l, url(path, l)])),
  });

  /** Le français reste la langue principale : les autres passent juste après. */
  const rank = (priority: number, locale: string) =>
    locale === routing.defaultLocale ? priority : priority * 0.9;

  const staticEntries: MetadataRoute.Sitemap = routes.flatMap(({ path, priority, changeFrequency }) =>
    routing.locales.map((locale) => ({
      url: url(path, locale),
      lastModified: now,
      changeFrequency,
      priority: rank(priority, locale),
      alternates: localized(path),
    })),
  );

  // Pages d'articles (dérivées de la même source que la page Actualité).
  const articles = await getArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.flatMap((article) => {
    const path = `/actualite/${article.slug}`;
    return routing.locales.map((locale) => ({
      url: url(path, locale),
      lastModified: new Date(article.date),
      changeFrequency: "monthly" as const,
      priority: rank(0.5, locale),
      alternates: localized(path),
    }));
  });

  // Pages /equipes/* (rosters, pôles, joueurs/membres) lues en base.
  const equipesEntries: MetadataRoute.Sitemap = (await getEquipesUrls()).flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(path, locale),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: rank(0.4, locale),
      alternates: localized(path),
    })),
  );

  return [...staticEntries, ...articleEntries, ...equipesEntries];
}
