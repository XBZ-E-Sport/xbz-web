import Link from "next/link";

import { staffRoster, type RoleVariant, type StaffEntry } from "@/content/staff";
import { esportRoster, type EsportEntry } from "@/content/esport";

type TeamsEntry = StaffEntry | EsportEntry;

export const metadata = { title: "Équipes & Staff — XBZ Esport" };

// Couleurs des badges reprises de l'ancien site
const roleStyles: Record<RoleVariant, string> = {
  founder: "bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]",
  staff: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff] shadow-[0_0_12px_rgba(160,90,255,0.25)]",
  member: "bg-xbz-blue/10 text-[#7fc8ff] shadow-[0_0_12px_rgba(0,102,255,0.2)]",
  creative: "bg-[rgba(0,200,255,0.12)] text-[#7fe6ff] shadow-[0_0_12px_rgba(0,200,255,0.2)]",
};

// Badge de disponibilité dérivé du nombre de places (source unique : slots)
const availabilityStyles = {
  open: "animate-pulse bg-gradient-to-r from-[#7ad7ff] to-xbz-blue text-[#111] shadow-[0_0_25px_rgba(0,102,255,0.6)]",
  closed: "bg-gradient-to-r from-xbz-orange to-xbz-dark-red text-[#111] shadow-[0_0_25px_rgba(255,15,16,0.6)]",
} as const;

// Nombre de places libres (source unique : slots) pour l'en-tête de section
function countOpenSlots(roster: TeamsEntry[]) {
  return roster.reduce((sum, entry) => {
    const [filled, total] = entry.slots.split("/").map(Number);
    if (!Number.isFinite(filled) || !Number.isFinite(total)) return sum;
    return sum + Math.max(0, total - filled);
  }, 0);
}

function SectionHeading({
  id,
  title,
  roster,
}: {
  id: string;
  title: string;
  roster: TeamsEntry[];
}) {
  const open = countOpenSlots(roster);
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

function RosterCard({ entry, index = 0 }: { entry: TeamsEntry; index?: number }) {
  const [filled, total] = entry.slots.split("/").map(Number);
  const isFull = Number.isFinite(filled) && Number.isFinite(total) && filled >= total;
  const pct =
    Number.isFinite(filled) && Number.isFinite(total) && total > 0
      ? Math.min(100, Math.max(0, (filled / total) * 100))
      : 0;

  const slotsStyle = isFull
    ? "border-[rgba(255,15,16,0.4)] bg-[rgba(255,15,16,0.12)] text-[#ff7a7a]"
    : "border-xbz-blue/30 bg-xbz-blue/10 text-[#7fc8ff]";

  const badgeClass = "inline-block rounded-lg px-2.5 py-1 text-[11px] font-black";

  const slotsLabel = isFull
    ? `Complet, ${total} place${total > 1 ? "s" : ""} sur ${total}`
    : `${filled} place${filled > 1 ? "s" : ""} occupée${filled > 1 ? "s" : ""} sur ${total}`;

  return (
    <li
      className={`card-xbz animate-fade-up flex h-48 w-72 flex-col overflow-hidden p-6 transition duration-300 hover:scale-103`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-xbz-blue">{entry.title}</h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-bold ${slotsStyle}`}
          aria-label={slotsLabel}
        >
          {isFull && (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M12 2a4 4 0 0 0-4 4v3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm-2 7V6a2 2 0 1 1 4 0v3h-4Z" />
            </svg>
          )}
          {entry.slots}
        </span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            isFull ? "bg-linear-to-r from-xbz-orange to-xbz-dark-red" : "bg-linear-to-r from-xbz-cyan to-xbz-blue"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-neutral-400">{entry.description}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {entry.tags.map((tag) => (
          <span
            key={tag.label}
            className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${roleStyles[tag.variant]}`}
          >
            {tag.label}
          </span>
        ))}
        {!entry.fixed &&
          (isFull ? (
            <span className={`${badgeClass} ${availabilityStyles.closed}`}>RECRUTEMENT FERMÉ</span>
          ) : (
            <Link
              href="/recrutement"
              aria-label={`${entry.title} : postuler — recrutement ouvert`}
              className={`${badgeClass} transition duration-300 hover:scale-103 hover:brightness-125 ${availabilityStyles.open}`}
            >
              RECRUTEMENT OUVERT
            </Link>
          ))}
      </div>
    </li>
  );
}

export default function EquipesPage() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-32">
      <h1 className="mb-10 text-center font-display text-3xl font-bold tracking-[3px] sm:text-4xl">
        PERSONNEL XBZ
      </h1>

      <section aria-labelledby="staff-heading">
        <SectionHeading id="staff-heading" title="STAFF" roster={staffRoster} />
        <ul className="flex flex-wrap justify-center gap-6">
          {staffRoster.map((entry, i) => (
            <RosterCard key={entry.title} entry={entry} index={i} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="esport-heading" className="mt-20">
        <SectionHeading id="esport-heading" title="ESPORT" roster={esportRoster} />
        <ul className="flex flex-wrap justify-center gap-6">
          {esportRoster.map((entry, i) => (
            <RosterCard key={entry.title} entry={entry} index={i} />
          ))}
        </ul>
      </section>
    </section>
  );
}