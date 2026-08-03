import { getTranslations } from "next-intl/server";

import { getArticleBySlug } from "@/lib/actualite";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

// Bannière générée à la volée (article lu en base à chaque partage).
export const dynamic = "force-dynamic";
export const alt = "Actualité XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Accent de la bannière selon la catégorie (aligné sur articleCategoryStyles).
// Les clés sont les valeurs en base, qui restent en français.
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
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  const article = await getArticleBySlug(slug, locale);

  if (!article) {
    return ogImage({ eyebrow: t("actualite.eyebrow"), title: t("articleNotFound") });
  }

  const tCat = await getTranslations({ locale, namespace: "articleCategories" });
  const [accent, accentTo] = CATEGORY_ACCENT[article.category] ?? ["#00bfff", "#0066ff"];
  return ogImage({
    eyebrow: tCat(article.category),
    title: article.title,
    subtitle: article.excerpt,
    accent,
    accentTo,
  });
}
