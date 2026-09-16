import Image from "next/image";

import { formatMatchDateTime, type Match } from "@/lib/matchs";

// Libellés résolus (le composant est serveur mais sans contexte de langue à
// l'intérieur d'un sous-composant sous `force-static` : ils viennent de la page).
export type MatchLabels = {
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

/** Carte d'un match : confrontation XBZ vs adversaire, score si terminé. */
export default function MatchCard({
  match,
  locale,
  labels,
}: {
  match: Match;
  locale: string;
  labels: MatchLabels;
}) {
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
        <time dateTime={match.startsAt} className="text-neutral-400 first-letter:uppercase">
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
