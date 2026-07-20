import Link from "next/link";
import Image from "next/image";

import type { Player } from "@/lib/roster";
import Flag from "@/components/Flag";

const roleBadge: Record<string, string> = {
  Capitaine: "bg-gradient-to-r from-xbz-cyan to-xbz-blue text-[#04141f]",
  Coach: "bg-[rgba(160,90,255,0.9)] text-white",
  Manager: "bg-[rgba(160,90,255,0.9)] text-white",
  Sub: "bg-white/15 text-white",
};

export default function PlayerCard({
  player,
  rosterSlug,
}: {
  player: Player;
  rosterSlug: string;
}) {
  const badge = roleBadge[player.role];

  return (
    <li>
      <Link
        href={`/equipes/${rosterSlug}/${player.slug}`}
        className="card-xbz group block overflow-hidden"
      >
        <div className="relative aspect-3/4 overflow-hidden bg-linear-to-br from-xbz-blue/25 to-xbz-cyan/10">
          {player.photo_url ? (
            <Image
              src={player.photo_url}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 300px"
              className="object-cover transition duration-500 motion-safe:group-hover:scale-105"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full items-center justify-center font-display text-6xl text-white/25"
            >
              {player.pseudo.charAt(0)}
            </span>
          )}

          {badge && (
            <span
              className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge}`}
            >
              {player.role}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="flex items-center gap-2 font-display text-lg text-white">
            <Flag code={player.pays_code} label={player.pays} />
            {player.pseudo}
          </h3>
          {player.nom && <p className="mt-0.5 text-sm text-xbz-cyan">{player.nom}</p>}
        </div>
      </Link>
    </li>
  );
}
