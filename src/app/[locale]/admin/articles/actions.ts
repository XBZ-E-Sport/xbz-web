"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { articleCategories } from "@/lib/actualite";
import { CACHE_TAGS } from "@/lib/cache";

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Normalise un texte en slug URL-safe (ex: "Ma News !" → "ma-news"). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

/** Slug libre pour `articles` (suffixe -2, -3… si déjà pris). */
async function uniqueArticleSlug(
  admin: AdminClient,
  base: string,
  excludeId: string | null,
): Promise<string> {
  const root = base || "article";
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { data, error } = await admin
      .from("articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error || !data || data.id === excludeId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Champs communs create/update, dérivés du formulaire. */
function buildRow(formData: FormData) {
  const categoryRaw = field(formData, "category");
  const category = (articleCategories as string[]).includes(categoryRaw) ? categoryRaw : "Annonce";
  // Un paragraphe par bloc séparé d'une ligne vide.
  const paragraphs = (name: string) =>
    field(formData, name)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

  return {
    title: field(formData, "title"),
    // Traductions facultatives : `null` en base plutôt que "" — c'est ce que
    // `localizedText` lit comme « absent », et ça reste vrai si on vide le champ.
    title_en: field(formData, "title_en") || null,
    excerpt: field(formData, "excerpt") || "",
    excerpt_en: field(formData, "excerpt_en") || null,
    content: paragraphs("content"),
    content_en: paragraphs("content_en"),
    category,
    author: field(formData, "author") || "Staff XBZ",
    date: field(formData, "date") || null, // null → défaut SQL (current_date)
    published: formData.get("published") === "on",
  };
}

function revalidateArticle(slug?: string) {
  // Invalide le cache de données des lectures publiques (getArticles, getArticleBySlug).
  revalidateTag(CACHE_TAGS.articles, "max");
  revalidatePath("/admin/articles");
  revalidatePath("/actualite");
  revalidatePath("/"); // l'accueil affiche les 3 dernières
  if (slug) revalidatePath(`/actualite/${slug}`);
}

export async function createArticle(formData: FormData) {
  const admin = await assertStaff();
  const title = field(formData, "title");
  if (!title) throw new Error("Le titre est obligatoire.");

  const slug = await uniqueArticleSlug(admin, slugify(field(formData, "slug") || title), null);
  const { error } = await admin.from("articles").insert({ slug, ...buildRow(formData) });
  if (error) {
    if (error.code === "23505") throw new Error("Un article avec ce slug existe déjà.");
    throw new Error(error.message);
  }

  revalidateArticle(slug);
}

export async function updateArticle(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const title = field(formData, "title");
  if (!title) throw new Error("Le titre est obligatoire.");

  const slug = await uniqueArticleSlug(admin, slugify(field(formData, "slug") || title), id);
  const { error } = await admin
    .from("articles")
    .update({ slug, ...buildRow(formData) })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Un article avec ce slug existe déjà.");
    throw new Error(error.message);
  }

  revalidateArticle(slug);
}

export async function deleteArticle(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const slug = field(formData, "slug");

  const { error } = await admin.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateArticle(slug || undefined);
}
