import Link from "next/link";
import { notFound } from "next/navigation";

import { getRosterBySlug } from "@/lib/roster";
import { getPoleBySlug } from "@/lib/equipes";
import PlayerCard from "@/components/PlayerCard";

// Données lues en base à chaque requête (back-office pilote rosters et pôles).
export const dynamic = "force-dynamic";

// Le segment [roster] résout d'abord un roster, puis un pôle (URL à plat :
// /equipes/ssl comme /equipes/moderateurs). Un roster gagne en cas d'homonymie.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ roster: string }>;
}) {
  const { roster: slug } = await params;
  const roster = await getRosterBySlug(slug);
  if (roster) {
    return {
      title: `${roster.name} — XBZ Esport`,
      description: roster.description ?? `L'effectif du ${roster.name} de XBZ Esport.`,
    };
  }
  const pole = await getPoleBySlug(slug);
  if (pole) {
    return {
      title: `${pole.name} — XBZ Esport`,
      description: pole.description ?? `Les membres du pôle ${pole.name} de XBZ Esport.`,
    };
  }
  return { title: "Page introuvable — XBZ Esport" };
}

export default async function EquipeDetailPage({
  params,
}: {
  params: Promise<{ roster: string }>;
}) {
  const { roster: slug } = await params;

  const roster = await getRosterBySlug(slug);
  if (roster) {
    return (
      <DetailLayout
        eyebrow={roster.rank}
        title={roster.name}
        description={roster.description}
        emptyLabel="L’effectif de ce roster arrive bientôt."
        count={roster.players.length}
      >
        {roster.players.map((player) => (
          <PlayerCard key={player.id} player={player} parentSlug={roster.slug} />
        ))}
      </DetailLayout>
    );
  }

  const pole = await getPoleBySlug(slug);
  if (pole) {
    return (
      <DetailLayout
        eyebrow={pole.category === "esport" ? "Pôle esport" : "Pôle staff"}
        title={pole.name}
        description={pole.description}
        emptyLabel="Les membres de ce pôle arrivent bientôt."
        count={pole.members.length}
      >
        {pole.members.map((member) => (
          <PlayerCard key={member.id} player={member} parentSlug={pole.slug} />
        ))}
      </DetailLayout>
    );
  }

  notFound();
}

function DetailLayout({
  eyebrow,
  title,
  description,
  emptyLabel,
  count,
  children,
}: {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  emptyLabel: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <Link
        href="/equipes"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> Toutes les équipes
      </Link>

      <header className="mb-14 mt-6 text-center">
        {eyebrow && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
            {description}
          </p>
        )}
      </header>

      {count === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
      )}
    </div>
  );
}
