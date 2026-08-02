import { getArticleBySlug } from "@/lib/actualite";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

// Bannière générée à la volée (article lu en base à chaque partage).
export const dynamic = "force-dynamic";
export const alt = "Actualité XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Accent de la bannière selon la catégorie (aligné sur articleCategoryStyles).
const CATEGORY_ACCENT: Record<string, [string, string]> = {
  Compétition: ["#7fc8ff", "#0066ff"],
  Recrutement: ["#7fe6ff", "#00bfff"],
  Annonce: ["#c9d6e3", "#8fb8d6"],
  Communauté: ["#b6bdff", "#5865f2"],
  Création: ["#c9a7ff", "#8a5cff"],
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return ogImage({ eyebrow: "Actualité", title: "Article introuvable" });
  }

  const [accent, accentTo] = CATEGORY_ACCENT[article.category] ?? ["#00bfff", "#0066ff"];
  return ogImage({
    eyebrow: article.category,
    title: article.title,
    subtitle: article.excerpt,
    accent,
    accentTo,
  });
}
