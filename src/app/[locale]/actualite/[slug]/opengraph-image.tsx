import { getTranslations } from "next-intl/server";

import { getArticleBySlug, type ArticleCategory } from "@/lib/actualite";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE, type OgTone } from "@/lib/og";

// Bannière générée à la volée (article lu en base à chaque partage).
export const dynamic = "force-dynamic";
export const alt = "Actualité XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Sur-titre aux couleurs de la charte : rouge pour la compétition (comme son
// badge sur le site), jaune pour tout le reste. Clés = valeurs en base (FR).
const CATEGORY_TONE: Partial<Record<ArticleCategory, OgTone>> = {
  Compétition: "red",
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
  return ogImage({
    eyebrow: tCat(article.category),
    title: article.title,
    subtitle: article.excerpt,
    tone: CATEGORY_TONE[article.category],
  });
}
