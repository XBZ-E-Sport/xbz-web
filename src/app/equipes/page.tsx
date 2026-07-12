import { roster, type RoleVariant } from "@/content/roster";

export const metadata = { title: "Équipes & Staff — XBZ Esport" };

// Couleurs des badges reprises de l'ancien site
const roleStyles: Record<RoleVariant, string> = {
  founder: "bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]",
  staff: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff] shadow-[0_0_12px_rgba(160,90,255,0.25)]",
  member: "bg-xbz-blue/10 text-[#7fc8ff] shadow-[0_0_12px_rgba(0,102,255,0.2)]",
  creative: "bg-[rgba(0,200,255,0.12)] text-[#7fe6ff] shadow-[0_0_12px_rgba(0,200,255,0.2)]",
  open: "animate-pulse bg-gradient-to-r from-[#7ad7ff] to-xbz-blue text-[#111] font-black shadow-[0_0_25px_rgba(0,102,255,0.6)]",
};

export default function EquipesPage() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-32">
      <h1 className="mb-10 text-center font-display text-3xl font-bold tracking-[3px] sm:text-4xl">
        PERSONNEL XBZ
      </h1>

      <div className="flex flex-wrap justify-center gap-6">
        {roster.map((entry) => (
          <div
            key={entry.title}
            className="w-72 overflow-hidden rounded-2xl border border-xbz-blue/20 bg-white/3 p-6 transition duration-300 hover:-translate-y-2 hover:border-xbz-blue hover:shadow-[0_0_25px_rgba(0,102,255,0.2)]"
          >
            <h3 className="mb-2 font-display text-lg text-xbz-blue">{entry.title}</h3>
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
        ))}
      </div>
    </section>
  );
}