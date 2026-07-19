import type { MetadataRoute } from "next";

import { getArticles } from "@/lib/actualite";
import { siteConfig } from "@/lib/site";

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

  return [...staticEntries, ...articleEntries];
}
