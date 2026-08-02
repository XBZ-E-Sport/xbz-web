// Couche d'accès aux actualités.
// Source : table Supabase `articles` (lecture publique des articles publiés,
// via RLS `published = true`). Les pages consomment ces fonctions sans savoir
// d'où viennent les données.

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";

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

const ARTICLE_COLS = "slug, title, excerpt, content, category, author, date";

/** Normalise une catégorie inconnue vers "Annonce" (garde-fou d'affichage). */
function normalizeCategory(value: string): ArticleCategory {
  return (articleCategories as string[]).includes(value)
    ? (value as ArticleCategory)
    : "Annonce";
}

type ArticleRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string[] | null;
  category: string;
  author: string | null;
  date: string;
};

function toArticle(row: ArticleRow): Article {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    content: row.content ?? [],
    category: normalizeCategory(row.category),
    author: row.author ?? "Staff XBZ",
    date: row.date,
  };
}

/** Liste des actualités publiées, les plus récentes d'abord. Cache : tag `articles`. */
export const getArticles = unstable_cache(
  async (): Promise<Article[]> => {
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
    return ((data ?? []) as ArticleRow[]).map(toArticle);
  },
  ["articles-list"],
  { tags: [CACHE_TAGS.articles], revalidate: CACHE_TTL_SECONDS },
);

/**
 * Un article publié par son slug, ou null s'il n'existe pas.
 * - `unstable_cache` : partagé entre requêtes (tag `articles`).
 * - `cache` (React) : mémoïsé dans un même rendu (generateMetadata + page = 1 appel).
 */
export const getArticleBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<Article | null> => {
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
      return data ? toArticle(data as ArticleRow) : null;
    },
    ["article-by-slug"],
    { tags: [CACHE_TAGS.articles], revalidate: CACHE_TTL_SECONDS },
  ),
);
