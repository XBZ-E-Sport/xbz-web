import type { MetadataRoute } from "next";

import { getArticles } from "@/lib/actualite";
import { getEquipesUrls } from "@/lib/equipes";
import { siteConfig } from "@/lib/site";

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
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Pages d'articles (dérivées de la même source que la page Actualité).
  const articles = await getArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${siteConfig.url}/actualite/${article.slug}`,
    lastModified: new Date(article.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Pages /equipes/* (rosters, pôles, joueurs/membres) lues en base.
  const equipesEntries: MetadataRoute.Sitemap = (await getEquipesUrls()).map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticEntries, ...articleEntries, ...equipesEntries];
}
