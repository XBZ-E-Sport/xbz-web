import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import ActualiteList from "@/components/ActualiteList";
import { getArticles } from "@/lib/actualite";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "actualite" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/actualite",
    locale,
  });
}

// Articles lus en base à chaque visite (pilotés par le back-office).
export const dynamic = "force-dynamic";

export default async function ActualitePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("actualite");
  const tNav = await getTranslations("nav");
  const articles = await getArticles();

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("actualite")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      <ActualiteList articles={articles} />
    </div>
  );
}
