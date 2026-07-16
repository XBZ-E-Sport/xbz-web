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
  open: "animate-pulse bg-gradient-to-r from-[#7ad7ff] to-xbz-blue text-[#111] font-black shadow-[0_0_25px_rgba(0,102,255,0.6)]",
  full: "bg-gradient-to-r from-[#7ad7ff] to-xbz-blue text-[#111] font-black shadow-[0_0_25px_rgba(0,102,255,0.6)]",
  closed: "bg-gradient-to-r from-xbz-orange to-xbz-dark-red text-[#111] font-black shadow-[0_0_25px_rgba(255,15,16,0.6)]",
};

function RosterCard({ entry }: { entry: TeamsEntry }) {
  const [filled, total] = entry.slots.split("/").map(Number);
  const isFull = Number.isFinite(filled) && Number.isFinite(total) && filled >= total;
  const isClosed = entry.tags.some(
    (tag) => tag.variant === "closed" || tag.label.includes("FERM"),
  );
  const slotsStyle =
    isFull || isClosed
      ? "border-[rgba(255,15,16,0.4)] bg-[rgba(255,15,16,0.12)] text-[#ff7a7a]"
      : "border-xbz-blue/30 bg-xbz-blue/10 text-[#7fc8ff]";

  return (
    <div className="w-72 overflow-hidden rounded-2xl border border-xbz-blue/20 bg-white/3 p-6 transition duration-300 hover:-translate-y-2 hover:border-xbz-blue hover:shadow-[0_0_25px_rgba(0,102,255,0.2)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-xbz-blue">{entry.title}</h3>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-sm font-bold ${slotsStyle}`}>
          {entry.slots}
        </span>
      </div>
      <p className="text-sm text-neutral-400">{entry.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {entry.tags.map((tag) => (
          <span
            key={tag.label}
            className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${roleStyles[tag.variant]}`}
          >
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EquipesPage() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-32">
      <h1 className="mb-10 text-center font-display text-3xl font-bold tracking-[3px] sm:text-4xl">
        PERSONNEL XBZ
      </h1>

      <h2 className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300">
        STAFF
      </h2>
      <div className="flex flex-wrap justify-center gap-6">
        {staffRoster.map((entry) => (
          <RosterCard key={entry.title} entry={entry} />
        ))}
      </div>

      <h2 className="mb-6 mt-20 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300">
        ESPORT
      </h2>
      <div className="flex flex-wrap justify-center gap-6">
        {esportRoster.map((entry) => (
          <RosterCard key={entry.title} entry={entry} />
        ))}
      </div>
    </section>
  );
}