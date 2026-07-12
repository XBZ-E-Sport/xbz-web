export const metadata = { title: "Qui sommes-nous ? — XBZ Esport" };

export default function AProposPage() {
  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-32">
      <div className="card-xbz p-8 sm:p-10">
        <h1 className="mb-6 font-display text-3xl font-bold sm:text-4xl">👑 Qui sommes-nous ?</h1>
        <div className="space-y-5 leading-relaxed text-neutral-300">
          <p>
            XBZ Esport est une structure compétitive en pleine évolution, créée pour rassembler des
            joueurs motivés, sérieux et ambitieux autour d’un objectif commun : progresser et
            performer dans l’esport.
          </p>
          <p>
            Nous sommes actifs principalement sur <strong className="text-white">Rocket League</strong>{" "}
            et <strong className="text-white">Warzone</strong>, avec une vision simple : construire des
            équipes solides, régulières et capables de jouer à un niveau compétitif réel.
          </p>
          <p>
            Ici, ce n’est pas juste une communauté. C’est une structure organisée avec des rôles, un
            staff actif, et une vraie volonté de développement sur le long terme.
          </p>
          <p>
            Chaque joueur, créateur ou membre du staff a une place importante dans l’évolution du
            projet. L’activité, la motivation et l’esprit d’équipe sont les bases de XBZ.
          </p>
          <p>🚀 Si tu veux progresser, jouer en équipe et faire évoluer un projet sérieux, alors XBZ est fait pour toi.</p>
        </div>
      </div>
    </section>
  );
}