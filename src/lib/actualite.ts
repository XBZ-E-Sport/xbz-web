// Couche d'accès aux actualités.
// Source : table Supabase `articles` (lecture publique des articles publiés,
// via RLS `published = true`). Les pages consomment ces fonctions sans savoir
// d'où viennent les données.

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import { localizedText, localizedList } from "@/lib/localized";

export type ArticleCategory =
  | "Compétition"
  | "Recrutement"
  | "Annonce"
  | "Communauté"
  | "Création";

export const articleCategories: ArticleCategory[] = [
  "Compétition",
  "Recrutement",
  "Annonce",
  "Communauté",
  "Création",
];

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  content: string[]; // paragraphes
  category: ArticleCategory;
  author: string;
  date: string; // ISO (YYYY-MM-DD)
};

const ARTICLE_COLS =
  "slug, title, title_en, excerpt, excerpt_en, content, content_en, category, author, date";

/** Normalise une catégorie inconnue vers "Annonce" (garde-fou d'affichage). */
function normalizeCategory(value: string): ArticleCategory {
  return (articleCategories as string[]).includes(value)
    ? (value as ArticleCategory)
    : "Annonce";
}

type ArticleRow = {
  slug: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
  excerpt_en: string | null;
  content: string[] | null;
  content_en: string[] | null;
  category: string;
  author: string | null;
  date: string;
};

/**
 * Ligne brute → article dans UNE langue.
 *
 * La résolution se fait ici, hors du cache : une seule entrée de cache sert les
 * deux langues, et les composants continuent de lire `article.title` sans rien
 * savoir de l'existence d'une colonne `title_en`.
 */
function toArticle(row: ArticleRow, locale: string): Article {
  return {
    slug: row.slug,
    title: localizedText(row.title, row.title_en, locale) ?? row.title,
    excerpt: localizedText(row.excerpt, row.excerpt_en, locale) ?? "",
    content: localizedList(row.content, row.content_en, locale),
    category: normalizeCategory(row.category),
    author: row.author ?? "Staff XBZ",
    date: row.date,
  };
}

/**
 * Lecture brute, bilingue, mise en cache (tag `articles`).
 *
 * Le cache ignore la langue : les deux variantes voyagent dans la même ligne,
 * donc une seule entrée sert `/fr` et `/en`. Mettre la langue dans la clé
 * doublerait les entrées et les lectures Supabase pour rien.
 */
const fetchArticles = unstable_cache(
  async (): Promise<ArticleRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("articles")
      .select(ARTICLE_COLS)
      .eq("published", true)
      .order("date", { ascending: false });

    if (error) {
      console.error("[actualite] select:", error.message);
      return [];
    }
    return (data ?? []) as ArticleRow[];
  },
  ["articles-list"],
  { tags: [CACHE_TAGS.articles], revalidate: CACHE_TTL_SECONDS },
);

/** Liste des actualités publiées, les plus récentes d'abord, dans `locale`. */
export async function getArticles(locale: string): Promise<Article[]> {
  return (await fetchArticles()).map((row) => toArticle(row, locale));
}

/**
 * Un article publié par son slug, ou null s'il n'existe pas.
 * - `unstable_cache` : partagé entre requêtes (tag `articles`).
 * - `cache` (React) : mémoïsé dans un même rendu (generateMetadata + page = 1 appel).
 */
const fetchArticleBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<ArticleRow | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("articles")
        .select(ARTICLE_COLS)
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (error) {
        console.error("[article] select:", error.message);
        return null;
      }
      return (data as ArticleRow) ?? null;
    },
    ["article-by-slug"],
    { tags: [CACHE_TAGS.articles], revalidate: CACHE_TTL_SECONDS },
  ),
);

/** Un article publié par son slug dans `locale`, ou null s'il n'existe pas. */
export async function getArticleBySlug(
  slug: string,
  locale: string,
): Promise<Article | null> {
  const row = await fetchArticleBySlug(slug);
  return row ? toArticle(row, locale) : null;
}
