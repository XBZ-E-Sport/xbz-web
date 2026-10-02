import type { MetadataRoute } from "next";

import { getArticles } from "@/lib/actualite";
import { getProductSlugs } from "@/lib/boutique";
import { emptyListPages } from "@/lib/empty-pages";
import { getEquipesUrls } from "@/lib/equipes";
import { getOffers } from "@/lib/offres";
import { absoluteUrl, localizedPath } from "@/lib/site";
import { routing } from "@/i18n/routing";

// Généré à la demande : le sitemap lit la base (rosters/pôles/joueurs, pages
// vides) → pas de dépendance BDD au build. Les lectures sont mises en cache.
export const dynamic = "force-dynamic";

// Pas de `lastModified` sur les pages fixes ni sur les équipes : il valait
// « maintenant » à chaque lecture. Une date qui change sans que la page change
// apprend à Google à ignorer TOUTES les dates du sitemap, y compris celles,
// vraies, des articles et des offres. Mieux vaut aucune date qu'une fausse.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages publiques principales (hors back-office).
  const routes: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/le-club", priority: 0.8, changeFrequency: "monthly" },
    { path: "/presentation", priority: 0.8, changeFrequency: "monthly" },
    { path: "/equipes", priority: 0.8, changeFrequency: "weekly" },
    { path: "/calendrier", priority: 0.7, changeFrequency: "weekly" },
    { path: "/recrutement", priority: 0.9, changeFrequency: "weekly" },
    { path: "/actualite", priority: 0.7, changeFrequency: "weekly" },
    { path: "/galerie", priority: 0.5, changeFrequency: "monthly" },
    { path: "/boutique", priority: 0.6, changeFrequency: "monthly" },
    { path: "/partenaires", priority: 0.5, changeFrequency: "monthly" },
    { path: "/carrieres", priority: 0.7, changeFrequency: "weekly" },
    { path: "/support", priority: 0.5, changeFrequency: "monthly" },
    { path: "/mentions-legales", priority: 0.3, changeFrequency: "monthly" },
    { path: "/confidentialite", priority: 0.3, changeFrequency: "monthly" },
    { path: "/cgv", priority: 0.3, changeFrequency: "monthly" },
  ];

  /** URL absolue d'un chemin non préfixé, dans une langue donnée. */
  const url = (path: string, locale: string) => absoluteUrl(localizedPath(path, locale));

  /**
   * Une entrée par langue, chacune déclarant ses alternatives via `alternates`.
   * C'est ce qui dit à Google que `/fr/equipes` et `/en/equipes` sont la même
   * page en deux langues, au lieu de deux pages concurrentes.
   */
  const localized = (path: string) => ({
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, url(path, l)])),
      // Comme le hreflang des pages (`languageAlternates`) : les deux doivent concorder.
      "x-default": url(path, routing.defaultLocale),
    },
  });

  /** Le français reste la langue principale : les autres passent juste après. */
  const rank = (priority: number, locale: string) =>
    locale === routing.defaultLocale ? priority : priority * 0.9;

  // Une page de liste vide (aucun partenaire, aucun match…) est en `noindex` :
  // la proposer à l'exploration enverrait un signal contradictoire.
  const empty = await emptyListPages();
  const staticEntries: MetadataRoute.Sitemap = routes
    .filter(({ path }) => !empty.has(path))
    .flatMap(({ path, priority, changeFrequency }) =>
      routing.locales.map((locale) => ({
        url: url(path, locale),
        changeFrequency,
        priority: rank(priority, locale),
        alternates: localized(path),
      })),
    );

  // Pages d'articles (dérivées de la même source que la page Actualité).
  // La langue n'a pas d'importance ici : seuls les slugs sont utilisés, et ils
  // sont identiques dans les deux langues.
  const articles = await getArticles(routing.defaultLocale);
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

  // Pages /equipes/* (rosters, pôles, joueurs/membres) lues en base. Une
  // équipe sans aucun membre est en `noindex` (voir sa page) : on la retire.
  // Aucun membre nulle part, en revanche, c'est une lecture des membres qui a
  // échoué, pas un club vide : on garde alors toutes les équipes.
  const equipesUrls = await getEquipesUrls();
  const withMembers = new Set(
    equipesUrls.map((u) => u.split("/")).filter((p) => p.length === 4).map((p) => p[2]),
  );
  const equipesEntries: MetadataRoute.Sitemap = equipesUrls
    .filter((path) => {
      const parts = path.split("/"); // ["", "equipes", équipe] ou [..., membre]
      return parts.length !== 3 || withMembers.size === 0 || withMembers.has(parts[2]);
    })
    .flatMap((path) =>
      routing.locales.map((locale) => ({
        url: url(path, locale),
        changeFrequency: "weekly" as const,
        priority: rank(0.4, locale),
        alternates: localized(path),
      })),
    );

  // Offres d'emploi : c'est par le sitemap qu'Indeed découvre les URL à crawler.
  const offers = await getOffers(routing.defaultLocale);
  const offerEntries: MetadataRoute.Sitemap = offers.flatMap((offer) => {
    const path = `/carrieres/${offer.slug}`;
    return routing.locales.map((locale) => ({
      url: url(path, locale),
      lastModified: new Date(offer.datePosted),
      changeFrequency: "weekly" as const,
      priority: rank(0.6, locale),
      alternates: localized(path),
    }));
  });

  // Pages produit (produits actifs, en vente ou « bientôt disponibles »).
  const productEntries: MetadataRoute.Sitemap = (await getProductSlugs()).flatMap((slug) => {
    const path = `/boutique/${slug}`;
    return routing.locales.map((locale) => ({
      url: url(path, locale),
      changeFrequency: "weekly" as const,
      priority: rank(0.5, locale),
      alternates: localized(path),
    }));
  });

  return [...staticEntries, ...articleEntries, ...equipesEntries, ...offerEntries, ...productEntries];
}
