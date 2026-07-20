import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getPlayer } from "@/lib/roster";
import Flag from "@/components/Flag";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roster: string; joueur: string }>;
}) {
  const { roster, joueur } = await params;
  const res = await getPlayer(roster, joueur);
  if (!res) return { title: "Joueur introuvable — XBZ Esport" };
  const { player } = res;
  return {
    title: `${player.pseudo} — XBZ Esport`,
    description: player.bio ?? `${player.pseudo}${player.nom ? ` (${player.nom})` : ""}, joueur XBZ Esport.`,
  };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ roster: string; joueur: string }>;
}) {
  const { roster: rosterSlug, joueur: playerSlug } = await params;
  const res = await getPlayer(rosterSlug, playerSlug);
  if (!res) notFound();
  const { player, roster } = res;

  const socials = [
    player.twitter && { label: "X / Twitter", href: player.twitter },
    player.twitch && { label: "Twitch", href: player.twitch },
    player.rltracker && { label: "RL Tracker", href: player.rltracker },
  ].filter(Boolean) as { label: string; href: string }[];

  const stats = [
    { label: "Rôle", value: player.role },
    player.rang && { label: "Rang", value: player.rang },
    player.mmr != null && { label: "MMR", value: String(player.mmr) },
    player.pays && { label: "Pays", value: player.pays },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-32">
      <Link
        href={`/equipes/${roster.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> {roster.name}
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[320px_1fr]">
        {/* Photo */}
        <div className="card-xbz relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-xbz-blue/25 to-xbz-cyan/10">
          {player.photo_url ? (
            <Image src={player.photo_url} alt="" fill sizes="320px" className="object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full items-center justify-center font-display text-8xl text-white/25"
            >
              {player.pseudo.charAt(0)}
            </span>
          )}
        </div>

        {/* Infos */}
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
            {player.role} · {roster.name}
          </p>
          <h1 className="flex items-center gap-3 font-display text-4xl font-black uppercase tracking-wide text-white sm:text-5xl">
            <Flag code={player.pays_code} label={player.pays} className="h-7 w-auto rounded-sm" />
            {player.pseudo}
          </h1>
          {player.nom && <p className="mt-2 text-lg text-neutral-300">{player.nom}</p>}

          {player.bio && (
            <p className="mt-6 leading-relaxed text-neutral-300">{player.bio}</p>
          )}

          {/* Stats */}
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card-xbz p-4 text-center">
                <dt className="text-xs uppercase tracking-wide text-neutral-500">{s.label}</dt>
                <dd className="mt-1 font-display text-lg text-white">{s.value}</dd>
              </div>
            ))}
          </dl>

          {/* Palmarès */}
          {player.palmares && player.palmares.length > 0 && (
            <section className="mt-8" aria-labelledby="palmares-heading">
              <h2
                id="palmares-heading"
                className="mb-3 font-display text-lg font-bold tracking-[2px] text-neutral-300"
              >
                PALMARÈS
              </h2>
              <ul className="flex flex-col gap-2">
                {player.palmares.map((titre, i) => (
                  <li key={i} className="flex items-center gap-2 text-neutral-300">
                    <span aria-hidden="true">🏆</span> {titre}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Réseaux */}
          {socials.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/5"
                >
                  {s.label}
                  <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
