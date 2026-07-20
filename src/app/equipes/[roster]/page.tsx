import Link from "next/link";
import { notFound } from "next/navigation";

import { getRosterBySlug } from "@/lib/roster";
import PlayerCard from "@/components/PlayerCard";

// Données lues en base à chaque requête (back-office pilote les rosters).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roster: string }>;
}) {
  const { roster: slug } = await params;
  const roster = await getRosterBySlug(slug);
  if (!roster) return { title: "Roster introuvable — XBZ Esport" };
  return {
    title: `${roster.name} — XBZ Esport`,
    description: roster.description ?? `L'effectif du ${roster.name} de XBZ Esport.`,
  };
}

export default async function RosterPage({
  params,
}: {
  params: Promise<{ roster: string }>;
}) {
  const { roster: slug } = await params;
  const roster = await getRosterBySlug(slug);
  if (!roster) notFound();

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <Link
        href="/equipes"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> Toutes les équipes
      </Link>

      <header className="mb-14 mt-6 text-center">
        {roster.rank && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
            {roster.rank}
          </p>
        )}
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {roster.name}
        </h1>
        {roster.description && (
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
            {roster.description}
          </p>
        )}
      </header>

      {roster.players.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">
          L’effectif de ce roster arrive bientôt.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {roster.players.map((player) => (
            <PlayerCard key={player.id} player={player} rosterSlug={roster.slug} />
          ))}
        </ul>
      )}
    </div>
  );
}
