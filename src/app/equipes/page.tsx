import Link from "next/link";

import { getEquipes, type Group, type GroupVariant } from "@/lib/equipes";

export const metadata = {
  title: "Équipes & Staff — XBZ Esport",
  description:
    "Le staff et les rosters compétitifs de XBZ Esport sur Rocket League, avec les postes actuellement ouverts au recrutement.",
};

// Données lues en base à chaque visite (slots dynamiques).
export const dynamic = "force-dynamic";

const roleStyles: Record<GroupVariant, string> = {
  founder: "bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]",
  staff: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff] shadow-[0_0_12px_rgba(160,90,255,0.25)]",
  member: "bg-xbz-blue/10 text-[#7fc8ff] shadow-[0_0_12px_rgba(0,102,255,0.2)]",
  creative: "bg-[rgba(0,200,255,0.12)] text-[#7fe6ff] shadow-[0_0_12px_rgba(0,200,255,0.2)]",
};
const variantLabel: Record<GroupVariant, string> = {
  founder: "FONDATEUR",
  staff: "STAFF",
  member: "JOUEUR",
  creative: "CRÉATIF",
};
const availabilityStyles = {
  open: "animate-pulse bg-gradient-to-r from-[#7ad7ff] to-xbz-blue text-[#111] shadow-[0_0_25px_rgba(0,102,255,0.6)]",
  closed: "bg-gradient-to-r from-xbz-orange to-xbz-dark-red text-[#111] shadow-[0_0_25px_rgba(255,15,16,0.6)]",
} as const;

function countOpen(groups: Group[]) {
  return groups.reduce((sum, g) => sum + Math.max(0, g.capacity - g.filled), 0);
}

function SectionHeading({ id, title, groups }: { id: string; title: string; groups: Group[] }) {
  const open = countOpen(groups);
  return (
    <h2
      id={id}
      className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
    >
      {title}
      <span className="ml-3 align-middle font-sans text-sm font-semibold tracking-normal text-xbz-cyan">
        {open > 0 ? `${open} poste${open > 1 ? "s" : ""} ouvert${open > 1 ? "s" : ""}` : "Complet"}
      </span>
    </h2>
  );
}

function GroupCard({ group, index = 0 }: { group: Group; index?: number }) {
  const { filled, capacity } = group;
  const isFull = filled >= capacity;
  const pct = capacity > 0 ? Math.min(100, Math.max(0, (filled / capacity) * 100)) : 0;

  const slotsStyle = isFull
    ? "border-[rgba(255,15,16,0.4)] bg-[rgba(255,15,16,0.12)] text-[#ff7a7a]"
    : "border-xbz-blue/30 bg-xbz-blue/10 text-[#7fc8ff]";
  const badgeClass = "inline-block rounded-lg px-2.5 py-1 text-[11px] font-black";
  const slotsLabel = isFull
    ? `Complet, ${capacity} place${capacity > 1 ? "s" : ""} sur ${capacity}`
    : `${filled} place${filled > 1 ? "s" : ""} occupée${filled > 1 ? "s" : ""} sur ${capacity}`;

  return (
    <li
      className="card-xbz animate-fade-up group relative flex h-48 w-72 flex-col overflow-hidden p-6 transition duration-300 hover:scale-103 hover:border-xbz-blue/40"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {/* Toute la carte (roster comme pôle) est cliquable vers sa page détail,
            via un lien « étiré » (::after). Le bouton RECRUTEMENT reste cliquable
            indépendamment grâce à son z-10. */}
        <h3 className="font-display text-lg">
          <Link
            href={`/equipes/${group.slug}`}
            className="text-xbz-blue transition after:absolute after:inset-0 after:content-[''] group-hover:text-xbz-cyan"
          >
            {group.name}
          </Link>
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-bold ${slotsStyle}`}
          aria-label={slotsLabel}
        >
          {isFull && (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M12 2a4 4 0 0 0-4 4v3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm-2 7V6a2 2 0 1 1 4 0v3h-4Z" />
            </svg>
          )}
          {filled}/{capacity}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            isFull
              ? "bg-linear-to-r from-xbz-orange to-xbz-dark-red"
              : "bg-linear-to-r from-xbz-cyan to-xbz-blue"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {group.description && <p className="text-sm text-neutral-400">{group.description}</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${roleStyles[group.variant]}`}>
          {variantLabel[group.variant]}
        </span>
        {!group.fixed &&
          group.recrute &&
          (isFull ? (
            <span className={`${badgeClass} ${availabilityStyles.closed}`}>RECRUTEMENT FERMÉ</span>
          ) : (
            <Link
              href="/recrutement"
              aria-label={`${group.name} : postuler — recrutement ouvert`}
              className={`relative z-10 ${badgeClass} transition duration-300 hover:scale-103 hover:brightness-125 ${availabilityStyles.open}`}
            >
              RECRUTEMENT OUVERT
            </Link>
          ))}
      </div>
    </li>
  );
}

export default async function EquipesPage() {
  const { staff, esport } = await getEquipes();

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Équipes
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Personnel XBZ
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          Le staff et les rosters compétitifs de XBZ — et les postes actuellement ouverts.
        </p>
      </header>

      {staff.length > 0 && (
        <section aria-labelledby="staff-heading">
          <SectionHeading id="staff-heading" title="STAFF" groups={staff} />
          <ul className="flex flex-wrap justify-center gap-6">
            {staff.map((g, i) => (
              <GroupCard key={g.id} group={g} index={i} />
            ))}
          </ul>
        </section>
      )}

      {esport.length > 0 && (
        <section aria-labelledby="esport-heading" className="mt-20">
          <SectionHeading id="esport-heading" title="ESPORT" groups={esport} />
          <ul className="flex flex-wrap justify-center gap-6">
            {esport.map((g, i) => (
              <GroupCard key={g.id} group={g} index={i} />
            ))}
          </ul>
        </section>
      )}

      {staff.length === 0 && esport.length === 0 && (
        <p className="card-xbz p-10 text-center text-neutral-400">
          L’effectif arrive bientôt.
        </p>
      )}
    </section>
  );
}
