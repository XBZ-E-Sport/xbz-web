import Link from "next/link";

import { getStructureStats } from "@/lib/equipes";

export const metadata = {
  title: "Présentation — XBZ Esport",
  description:
    "Qui est XBZ Esport : une structure compétitive, organisée et ambitieuse, active sur Rocket League.",
};

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

// Stats lues en base (slots dynamiques).
export const dynamic = "force-dynamic";

const values = [
  {
    icon: "🏆",
    title: "Compétition",
    text: "Viser le haut niveau et performer dans un cadre exigeant, match après match.",
  },
  {
    icon: "🤝",
    title: "Esprit d’équipe",
    text: "Jouer ensemble, s’entraider et avancer collectivement plutôt que chacun de son côté.",
  },
  {
    icon: "📈",
    title: "Progression",
    text: "Monter en niveau, individuellement et en équipe, dans la durée.",
  },
  {
    icon: "🎯",
    title: "Sérieux & ambition",
    text: "Un engagement régulier et un projet structuré qui voit grand sur le long terme.",
  },
];

export default async function PresentationPage() {
  const structure = await getStructureStats();
  const stats = [
    { value: structure.teams, label: "Équipes compétitives" },
    { value: structure.poles, label: "Pôles staff & création" },
    { value: structure.members, label: "Membres dans la structure" },
    { value: structure.openSlots, label: "Postes ouverts" },
  ];
  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Présentation
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Qui sommes-nous ?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          Une structure esport compétitive, organisée et ambitieuse — construite pour
          progresser ensemble sur{" "}
          <strong className="font-semibold text-white">Rocket League</strong>.
        </p>
      </header>

      <section aria-labelledby="pitch-heading" className="mb-16">
        <div className="card-xbz p-8 sm:p-10">
          <h2 id="pitch-heading" className="mb-5 font-display text-2xl font-bold sm:text-3xl">
            La structure XBZ
          </h2>
          <div className="space-y-5 leading-relaxed text-neutral-300">
            <p>
              XBZ Esport est une structure compétitive en pleine évolution, créée pour
              rassembler des joueurs motivés, sérieux et ambitieux autour d’un objectif
              commun : progresser et performer dans l’esport.
            </p>
            <p>
              Nous sommes actifs sur <strong className="text-white">Rocket League</strong>, avec
              une vision simple : construire des équipes solides, régulières et capables de jouer
              à un niveau compétitif réel.
            </p>
            <p>
              Ici, ce n’est pas juste une communauté. C’est une structure organisée, avec des
              rôles définis, un staff actif et une vraie volonté de développement sur le long
              terme.
            </p>
            <p>
              Chaque joueur, créateur ou membre du staff a une place importante dans l’évolution
              du projet. L’activité, la motivation et l’esprit d’équipe sont les fondations de
              XBZ.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="chiffres-heading" className="mb-16">
        <h2
          id="chiffres-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          EN QUELQUES CHIFFRES
        </h2>
        {/* Liste de description (clé/valeur) : sémantiquement correct pour des
            stats, et évite que les grands nombres soient pris pour des titres. */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card-xbz flex flex-col-reverse gap-2 p-6 text-center">
              <dt className="text-sm text-neutral-400">{s.label}</dt>
              <dd className="font-display text-4xl font-black text-xbz-cyan">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="valeurs-heading" className="mb-16">
        <h2
          id="valeurs-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          NOS VALEURS
        </h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {values.map((v) => (
            <li key={v.title} className="card-xbz flex gap-4 p-6">
              <span aria-hidden="true" className="text-3xl leading-none">
                {v.icon}
              </span>
              <div>
                <h3 className="font-display text-lg text-xbz-blue">{v.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-400">{v.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cta-heading">
        <div className="card-xbz p-8 text-center sm:p-10">
          <h2 id="cta-heading" className="font-display text-2xl font-bold sm:text-3xl">
            Envie de faire partie de l’aventure ?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-300">
            Rejoins le Discord pour échanger avec la structure, ou consulte les postes ouverts.
          </p>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#5865F2] px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              Rejoindre le Discord
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
            <Link
              href="/recrutement"
              className="rounded-xl border border-white/25 px-7 py-3.5 text-center font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
            >
              Nous rejoindre
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
