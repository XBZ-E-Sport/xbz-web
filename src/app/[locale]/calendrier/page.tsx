import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getMatchBoards, type Match } from "@/lib/matchs";
import MatchCard, { type MatchLabels } from "@/components/MatchCard";
import { pageMetadata } from "@/lib/site";

// Rendu statique régénéré en arrière-plan (ISR). Les matchs viennent de la base ;
// le back-office invalide le cache à chaque écriture. `force-static` est requis
// sous `[locale]` (cf. le commentaire détaillé sur /boutique).
export const dynamic = "force-static";
export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calendrier" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/calendrier",
    locale,
  });
}

function Board({
  id,
  heading,
  matches,
  empty,
  locale,
  labels,
}: {
  id: string;
  heading: string;
  matches: Match[];
  empty: string;
  locale: string;
  labels: MatchLabels;
}) {
  return (
    <section aria-labelledby={id} className="mb-16">
      <h2 id={id} className="mb-6 font-display text-xl font-bold tracking-[2px] text-neutral-300">
        {heading}
      </h2>
      {matches.length === 0 ? (
        <p className="card-xbz p-8 text-center text-neutral-400">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} locale={locale} labels={labels} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function CalendrierPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "calendrier" });
  const { upcoming, results } = await getMatchBoards();

  const labels: MatchLabels = {
    vs: t("vs"),
    watch: t("watch"),
    newTab: t("newTab"),
    cancelled: t("cancelled"),
    result: { win: t("win"), loss: t("loss"), draw: t("draw") },
  };

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(220,37,21,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      <Board
        id="upcoming-heading"
        heading={t("upcomingHeading")}
        matches={upcoming}
        empty={t("emptyUpcoming")}
        locale={locale}
        labels={labels}
      />
      <Board
        id="results-heading"
        heading={t("resultsHeading")}
        matches={results}
        empty={t("emptyResults")}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}
