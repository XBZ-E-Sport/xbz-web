import Link from "next/link";

export const metadata = {
  title: "Le club — XBZ Esport",
  description:
    "Le club XBZ Esport en un coup d’œil : ses pôles et tous les accès (équipes, recrutement, actualité, boutique, communauté).",
};

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

const poles = [
  { icon: "🎮", title: "Esport", text: "Des équipes compétitives sur Rocket League." },
  { icon: "💬", title: "Communauté", text: "Un Discord actif pour jouer et échanger." },
  { icon: "🎬", title: "Création", text: "Graphistes, monteurs et casters qui font vivre le contenu." },
  { icon: "🛡️", title: "Staff", text: "Une organisation structurée qui encadre le tout." },
];

const sections = [
  {
    href: "/presentation",
    icon: "👑",
    title: "Présentation",
    text: "Qui sommes-nous, nos valeurs et notre vision.",
  },
  {
    href: "/equipes",
    icon: "🎮",
    title: "Équipes",
    text: "Nos rosters compétitifs et le staff qui les encadre.",
  },
  {
    href: "/recrutement",
    icon: "📝",
    title: "Recrutement",
    text: "Rejoins la structure : postes joueurs, staff et création ouverts.",
  },
  {
    href: "/actualite",
    icon: "📰",
    title: "Actualité",
    text: "Les dernières news, résultats et annonces du club.",
  },
  {
    href: "/boutique",
    icon: "🛒",
    title: "Boutique",
    text: "Le merch officiel aux couleurs de XBZ.",
  },
  {
    href: "/support",
    icon: "✉️",
    title: "Support",
    text: "Une question ? Contacte le staff.",
  },
];

export default function LeClubPage() {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Le club
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Bienvenue chez XBZ
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          Le point de départ pour tout découvrir : nos pôles, nos équipes, le recrutement,
          la boutique et la communauté.
        </p>
      </header>

      <section aria-labelledby="poles-heading" className="mb-16">
        <h2
          id="poles-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          LE CLUB EN 4 PÔLES
        </h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {poles.map((p) => (
            <li key={p.title} className="card-xbz p-6 text-center">
              <span aria-hidden="true" className="text-3xl leading-none">
                {p.icon}
              </span>
              <h3 className="mt-3 font-display text-lg text-xbz-blue">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-400">{p.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="explorer-heading" className="mb-16">
        <h2
          id="explorer-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          EXPLORER
        </h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="card-xbz group flex h-full items-start gap-4 p-6 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
              >
                <span aria-hidden="true" className="text-3xl leading-none">
                  {s.icon}
                </span>
                <div className="flex-1">
                  <h3 className="flex items-center gap-1 font-display text-lg text-xbz-blue">
                    {s.title}
                    <span
                      aria-hidden="true"
                      className="text-xbz-cyan transition-transform duration-300 motion-safe:group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">{s.text}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="communaute-heading">
        <div className="card-xbz p-8 text-center sm:p-10">
          <h2 id="communaute-heading" className="font-display text-2xl font-bold sm:text-3xl">
            Rejoins la communauté
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-300">
            Tout se passe sur notre Discord : discussions, événements, entraînements et
            recrutement. C’est là que vit le club au quotidien.
          </p>
          <div className="mt-7 flex justify-center">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#5865F2] px-8 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              Rejoindre le Discord
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
