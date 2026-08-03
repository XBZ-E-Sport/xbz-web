import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getArticles } from "@/lib/actualite";
import { formatDate, articleCategoryStyles } from "@/lib/format";
import { getStructureStats } from "@/lib/equipes";
import { jsonLdString } from "@/lib/jsonld";
import { siteConfig, absoluteUrl } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { description: t("metaDescription") };
}

// Stats lues en base (slots dynamiques).
export const dynamic = "force-dynamic";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

// JSON-LD Organization (SEO : rich results Google), décrit dans la langue de la page.
const orgJsonLd = (description: string) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  alternateName: siteConfig.shortName,
  url: siteConfig.url,
  logo: absoluteUrl("/logo-xbz.png"),
  description,
  ...(siteConfig.discord ? { sameAs: [siteConfig.discord] } : {}),
});

export default async function Home({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tNav, tCat, tSite, latest, structure] = await Promise.all([
    getTranslations("home"),
    getTranslations("nav"),
    getTranslations("articleCategories"),
    getTranslations("site"),
    getArticles().then((a) => a.slice(0, 3)),
    getStructureStats(),
  ]);
  const openCount = structure.openSlots;
  const stats = [
    { value: structure.teams, label: t("statsTeams") },
    { value: structure.poles, label: t("statsPoles") },
    { value: structure.members, label: t("statsMembers") },
    { value: structure.openSlots, label: t("statsOpenSlots") },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(orgJsonLd(tSite("description"))) }}
      />

      {/* ===== HERO ===== */}
      <section
        aria-labelledby="hero-title"
        className="relative z-10 flex min-h-[88svh] flex-col items-center justify-center gap-7 px-6 py-24 text-center"
      >
        {/* Logo décoratif : le nom du club est déjà porté par le <h1> juste après */}
        <Image
          src="/logo-xbz.png"
          alt=""
          width={208}
          height={208}
          preload
          className="h-32 w-32 drop-shadow-[0_0_25px_rgba(0,102,255,0.45)] sm:h-48 sm:w-48"
        />

        <h1
          id="hero-title"
          className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_35px_rgba(0,102,255,0.55)] sm:text-6xl sm:tracking-widest md:text-7xl"
        >
          XBZ Esport
        </h1>

        <p className="max-w-xl text-balance text-lg leading-relaxed text-neutral-300 sm:text-xl">
          {t.rich("heroTagline", {
            game: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
          })}
        </p>

        {/* Statut recrutement — dérivé des places libres (source unique : slots) */}
        {openCount > 0 ? (
          <Link
            href="/recrutement"
            className="inline-flex items-center gap-2 rounded-full border border-xbz-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-semibold text-xbz-cyan transition hover:border-xbz-cyan/60 hover:bg-white/10"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-xbz-cyan motion-safe:animate-pulse"
            />
            {t("openSlots", { count: openCount })}
          </Link>
        ) : (
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-neutral-300">
            <span aria-hidden="true">⏳</span> {t("recruitmentSoon")}
          </p>
        )}

        {/* Appels à l'action */}
        <div className="mt-2 flex w-full max-w-md flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#5865F2] px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 hover:cursor-pointer motion-safe:hover:-translate-y-0.5"
          >
            {tNav("joinDiscord")}
            <span className="sr-only">{tNav("newTab")}</span>
          </a>
          <Link
            href="/recrutement"
            className="rounded-xl border border-white/25 px-7 py-3.5 text-center font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
          >
            {t("joinUs")}
          </Link>
        </div>
      </section>

      {/* ===== APERÇU (bref, pour inciter à explorer chaque page) ===== */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        {/* Stats */}
        <section aria-labelledby="stats-heading" className="mb-20">
          <h2 id="stats-heading" className="sr-only">
            {t("statsHeading")}
          </h2>
          {/* Liste de description (clé/valeur) : sémantiquement correct pour des
              stats, et évite que les grands nombres soient pris pour des titres. */}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card-xbz flex flex-col-reverse gap-2 p-6 text-center">
                <dt className="text-sm text-neutral-400">{s.label}</dt>
                <dd className="font-display text-4xl font-black text-xbz-cyan">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Dernières actualités */}
        {latest.length > 0 && (
          <section aria-labelledby="latest-heading" className="mb-20">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2
                id="latest-heading"
                className="font-display text-xl font-bold tracking-[2px] text-neutral-300"
              >
                {t("latestHeading")}
              </h2>
              <Link
                href="/actualite"
                className="shrink-0 text-sm font-semibold text-xbz-cyan hover:underline"
              >
                {t("seeAll")}
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/actualite/${article.slug}`}
                    className="card-xbz group flex h-full flex-col p-6 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-md px-2 py-0.5 font-bold uppercase tracking-wide ${articleCategoryStyles[article.category]}`}
                      >
                        {tCat(article.category)}
                      </span>
                      <time dateTime={article.date} className="text-neutral-400">
                        {formatDate(article.date, locale)}
                      </time>
                    </div>
                    <h3 className="mt-3 font-display text-lg text-xbz-blue">{article.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-400">
                      {article.excerpt}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Explorer — pousse vers chaque page */}
        <section aria-labelledby="explore-heading">
          <h2
            id="explore-heading"
            className="mb-6 font-display text-xl font-bold tracking-[2px] text-neutral-300"
          >
            {t("exploreHeading")}
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { href: "/presentation", icon: "👑", label: tNav("presentation") },
              { href: "/equipes", icon: "🎮", label: tNav("equipes") },
              { href: "/recrutement", icon: "📝", label: tNav("recrutement") },
              { href: "/boutique", icon: "🛒", label: tNav("boutique") },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="card-xbz group flex h-full flex-col items-center gap-2 p-6 text-center transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
                >
                  <span aria-hidden="true" className="text-3xl leading-none">
                    {item.icon}
                  </span>
                  <span className="font-display text-sm text-xbz-blue">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
