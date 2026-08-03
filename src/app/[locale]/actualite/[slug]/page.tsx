import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getArticleBySlug } from "@/lib/actualite";
import { formatDate, articleCategoryStyles } from "@/lib/format";
import { jsonLdString } from "@/lib/jsonld";
import { siteConfig, absoluteUrl, pageMetadata } from "@/lib/site";

// Article lu en base à chaque visite (piloté par le back-office).
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    const t = await getTranslations({ locale, namespace: "article" });
    return { title: t("metaNotFound") };
  }
  return pageMetadata({
    title: `${article.title} — XBZ Esport`,
    description: article.excerpt,
    path: `/actualite/${article.slug}`,
    locale,
    ogType: "article",
  });
}

export default async function ArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("article");
  const tCat = await getTranslations("articleCategories");

  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  // JSON-LD BlogPosting (SEO : rich results / Google Actualités).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    dateModified: article.date,
    articleSection: article.category,
    author: { "@type": "Organization", name: article.author },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: absoluteUrl("/logo-xbz.png") },
    },
    mainEntityOfPage: absoluteUrl(`/actualite/${article.slug}`),
  };

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <Link
        href="/actualite"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> {t("backToNews")}
      </Link>

      <article className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${articleCategoryStyles[article.category]}`}
          >
            {tCat(article.category)}
          </span>
          <time dateTime={article.date} className="text-sm text-neutral-400">
            {formatDate(article.date, locale)}
          </time>
        </div>

        <h1 className="mt-4 font-display text-3xl font-black leading-tight text-white sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-sm text-neutral-400">{t("by", { author: article.author })}</p>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-neutral-300">
          {article.content.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </article>

      <div className="mt-12 border-t border-white/10 pt-8 text-center">
        <p className="text-neutral-300">{t("ctaText")}</p>
        <Link
          href="/recrutement"
          className="mt-4 inline-block rounded-xl border border-white/25 px-7 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
        >
          {t("ctaButton")}
        </Link>
      </div>
    </div>
  );
}
