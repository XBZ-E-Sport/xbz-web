import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getMatchBoards, formatMatchDateTime, type Match } from "@/lib/matchs";
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

type Labels = {
  vs: string;
  watch: string;
  newTab: string;
  cancelled: string;
  result: Record<"win" | "loss" | "draw", string>;
};

const resultBadge: Record<"win" | "loss" | "draw", string> = {
  win: "bg-emerald-500/15 text-emerald-300",
  loss: "bg-red-500/15 text-red-300",
  draw: "bg-white/10 text-neutral-300",
};

/** Logo d'équipe sur pastille claire (les logos sont souvent sombres). */
function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="relative mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white/90">
      {src ? (
        <Image src={src} alt={name} fill sizes="56px" className="object-contain p-2" />
      ) : (
        <span aria-hidden="true" className="font-display text-xl font-black text-neutral-800">
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

function MatchCard({ match, locale, labels }: { match: Match; locale: string; labels: Labels }) {
  const xbzName = match.roster?.name ?? "XBZ Esport";
  const isFinished = match.status === "finished";
  const isCancelled = match.status === "cancelled";

  return (
    <li className="card-xbz flex flex-col p-5">
      {/* En-tête : compétition + format, date/heure */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {match.competition && (
            <span className="font-semibold uppercase tracking-wide text-xbz-cyan">
              {match.competition}
            </span>
          )}
          <span className="rounded bg-white/10 px-2 py-0.5 font-bold text-neutral-300">
            {match.format}
          </span>
          {isCancelled && (
            <span className="rounded bg-red-500/15 px-2 py-0.5 font-bold text-red-300">
              {labels.cancelled}
            </span>
          )}
        </div>
        <time
          dateTime={match.startsAt}
          className="text-neutral-400 first-letter:uppercase"
        >
          {formatMatchDateTime(match.startsAt, locale)}
        </time>
      </div>

      {/* Confrontation : XBZ vs adversaire */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <TeamLogo src="/logo-xbz.png" name="XBZ" />
          <p className="mt-2 font-display text-sm text-white">{xbzName}</p>
        </div>

        <div className="text-center">
          {isFinished && match.scoreXbz !== null && match.scoreOpponent !== null ? (
            <span
              className={`inline-block rounded-lg px-3 py-1 font-display text-2xl font-black ${match.result ? resultBadge[match.result] : "bg-white/10 text-white"}`}
            >
              {match.scoreXbz} – {match.scoreOpponent}
            </span>
          ) : (
            <span className="font-display text-lg font-bold text-neutral-500">{labels.vs}</span>
          )}
          {isFinished && match.result && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              {labels.result[match.result]}
            </p>
          )}
        </div>

        <div className="text-center">
          <TeamLogo src={match.opponentLogo} name={match.opponent} />
          <p className="mt-2 font-display text-sm text-white">{match.opponent}</p>
        </div>
      </div>

      {/* Stream / VOD */}
      {match.streamUrl && (
        <div className="mt-4 text-center">
          <a
            href={match.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-semibold text-xbz-cyan transition hover:text-white"
          >
            {labels.watch} →<span className="sr-only">{labels.newTab}</span>
          </a>
        </div>
      )}
    </li>
  );
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
  labels: Labels;
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

  const labels: Labels = {
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
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
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
