import { getTranslations } from "next-intl/server";

import { getArticleBySlug } from "@/lib/actualite";
import { articleCategoryTone } from "@/lib/format";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

// Bannière générée à la volée (article lu en base à chaque partage).
export const dynamic = "force-dynamic";
export const alt = "Actualité XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

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
    // Même teinte que le badge de l'article sur le site (le neutre passe en jaune).
    tone: articleCategoryTone[article.category] === "red" ? "red" : "yellow",
  });
}
