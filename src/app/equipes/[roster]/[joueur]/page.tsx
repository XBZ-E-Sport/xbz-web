import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getPlayer, type Player } from "@/lib/roster";
import { getPoleBySlug } from "@/lib/equipes";
import { pageMetadata } from "@/lib/site";
import Flag from "@/components/Flag";

export const dynamic = "force-dynamic";

/**
 * Résout un membre par slug parent + slug membre : d'abord un joueur de roster,
 * sinon un membre de pôle. `parent` porte le slug + le nom pour l'en-tête.
 */
type Parent = { slug: string; name: string; kind: "roster" | "pole" };

async function resolveMember(
  parentSlug: string,
  memberSlug: string,
): Promise<{ player: Player; parent: Parent } | null> {
  const res = await getPlayer(parentSlug, memberSlug);
  if (res) {
    return { player: res.player, parent: { slug: res.roster.slug, name: res.roster.name, kind: "roster" } };
  }

  const pole = await getPoleBySlug(parentSlug);
  const member = pole?.members.find((m) => m.slug === memberSlug);
  if (pole && member) {
    return { player: member, parent: { slug: pole.slug, name: pole.name, kind: "pole" } };
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roster: string; joueur: string }>;
}) {
  const { roster, joueur } = await params;
  const res = await resolveMember(roster, joueur);
  if (!res) return { title: "Membre introuvable — XBZ Esport" };
  const { player, parent } = res;
  return pageMetadata({
    title: `${player.pseudo} — XBZ Esport`,
    description: player.bio ?? `${player.pseudo}${player.nom ? ` (${player.nom})` : ""}, membre de XBZ Esport.`,
    path: `/equipes/${parent.slug}/${player.slug}`,
  });
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ roster: string; joueur: string }>;
}) {
  const { roster: parentSlug, joueur: memberSlug } = await params;
  const res = await resolveMember(parentSlug, memberSlug);
  if (!res) notFound();
  const { player, parent } = res;

  const socials = [
    player.twitter && { label: "X / Twitter", href: player.twitter },
    player.twitch && { label: "Twitch", href: player.twitch },
    player.rltracker && { label: "RL Tracker", href: player.rltracker },
  ].filter(Boolean) as { label: string; href: string }[];

  // Le rôle est déjà affiché au-dessus du nom ({role} · {parent}) : pas de doublon ici.
  const stats = [
    player.rang && { label: "Rang", value: player.rang },
    player.mmr != null && { label: "MMR", value: String(player.mmr) },
    player.pays && { label: "Pays", value: player.pays },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-32">
      <Link
        href={`/equipes/${parent.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> {parent.name}
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[320px_1fr]">
        {/* Photo */}
        <div className="card-xbz relative aspect-3/4 overflow-hidden bg-linear-to-br from-xbz-blue/25 to-xbz-cyan/10">
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
            {/* Pour un pôle, le pôle EST le rôle : on n'affiche pas de sous-rôle. */}
            {parent.kind === "pole" ? parent.name : `${player.role} · ${parent.name}`}
          </p>
          <h1 className="flex items-center gap-3 font-display text-4xl font-black uppercase tracking-wide text-white sm:text-5xl">
            <Flag code={player.pays_code} label={player.pays} className="h-7 w-auto rounded-sm" />
            {player.pseudo}
          </h1>
          {player.nom && <p className="mt-2 text-lg text-neutral-300">{player.nom}</p>}

          {player.bio && (
            <p className="mt-6 leading-relaxed text-neutral-300">{player.bio}</p>
          )}

          {/* Stats (masquées s'il n'y a rien à montrer, ex : membre de pôle) */}
          {stats.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="card-xbz p-4 text-center">
                  <dt className="text-xs uppercase tracking-wide text-neutral-400">{s.label}</dt>
                  <dd className="mt-1 font-display text-lg text-white">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

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
