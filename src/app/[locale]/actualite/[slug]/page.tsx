import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getArticleBySlug, getArticleSlugs } from "@/lib/actualite";
import { formatDate, articleCategoryStyles } from "@/lib/format";
import { jsonLdString } from "@/lib/jsonld";
import { articleBanner, bannerVersion } from "@/lib/og-banners";
import { breadcrumbJsonLd, pageDescription } from "@/lib/seo";
import { siteConfig, absoluteUrl, localizedPath, pageMetadata } from "@/lib/site";

// Rendu statique régénéré en arrière-plan (ISR), au lieu d'un rendu serveur
// par visite. L'article venait d'une lecture BDD par affichage.
//
// `force-static` est indispensable, et pas seulement à cause du segment
// `[locale]` : la doc de Next le dit pour les routes dynamiques — sans lui, une
// page dont le slug n'était pas connu au build ne serait jamais mise en cache
// après coup. Un article publié cet après-midi resterait en rendu par visite
// jusqu'au prochain déploiement.
//
// Les slugs inconnus de `generateStaticParams` restent servis à la demande
// (`dynamicParams` vaut true par défaut), puis mis en cache. Un article
// fraîchement publié est donc accessible immédiatement.
export const dynamic = "force-static";
export const revalidate = 3600;

/** Prégénère les articles connus au build ; la langue vient du layout. */
export async function generateStaticParams() {
  return (await getArticleSlugs()).map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  const article = await getArticleBySlug(slug, locale);
  if (!article) return { title: t("metaNotFound") };
  return pageMetadata({
    title: `${article.title} — XBZ Esport`,
    // Le résumé, sinon le premier paragraphe assez riche : un article sans
    // résumé n'avait aucune description, Google en inventait une.
    description: pageDescription(
      [article.excerpt, ...article.content],
      t("metaFallback", { title: article.title }),
    ),
    path: `/actualite/${article.slug}`,
    locale,
    ogType: "article",
    publishedTime: article.date,
  });
}

export default async function ArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "article" });
  const tCat = await getTranslations({ locale, namespace: "articleCategories" });

  const article = await getArticleBySlug(slug, locale);
  if (!article) notFound();

  const path = `/actualite/${article.slug}`;
  const pageUrl = absoluteUrl(localizedPath(path, locale));
  // Même adresse que l'og:image de la page (identifiant versionné compris).
  const banner = await articleBanner(locale, article.slug);
  const imageUrl = absoluteUrl(localizedPath(`${path}/opengraph-image/${bannerVersion(banner)}`, locale));

  // JSON-LD BlogPosting (SEO : rich results / Google Actualités). L'adresse
  // porte la langue : sans préfixe, elle partait en redirection vers /fr, même
  // depuis la page anglaise. `image` : sans elle, Google n'avait aucun visuel
  // à associer à l'article (résultats enrichis, Discover).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: pageDescription([article.excerpt, ...article.content], article.title),
    image: [imageUrl],
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: locale,
    articleSection: tCat(article.category),
    author: { "@type": "Organization", name: article.author, url: absoluteUrl(localizedPath("/", locale)) },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: absoluteUrl("/logo-xbz-light.png") },
    },
    url: pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const breadcrumb = breadcrumbJsonLd(
    [
      { name: tNav("home"), path: "/" },
      { name: tNav("actualite"), path: "/actualite" },
      { name: article.title, path },
    ],
    locale,
  );

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }}
      />

      <Link
        href="/actualite"
        locale={locale}
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
          locale={locale}
          className="mt-4 inline-block rounded-xl border border-white/25 px-7 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
        >
          {t("ctaButton")}
        </Link>
      </div>
    </div>
  );
}
