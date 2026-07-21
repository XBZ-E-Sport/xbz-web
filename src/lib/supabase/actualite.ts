// Couche d'accès aux actualités.
// Source : table Supabase `articles` (lecture publique des articles publiés,
// via RLS `published = true`). Les pages consomment ces fonctions sans savoir
// d'où viennent les données.

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

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

/** Liste des actualités publiées, les plus récentes d'abord. */
export async function getArticles(): Promise<Article[]> {
  const supabase = await createClient();
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
}

/**
 * Un article publié par son slug, ou null s'il n'existe pas.
 * Mémoïsé par requête : generateMetadata + la page ne font qu'un appel.
 */
export const getArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const supabase = await createClient();
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
});
