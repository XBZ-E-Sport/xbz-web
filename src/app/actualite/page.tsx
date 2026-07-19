import ActualiteList from "@/components/ActualiteList";
import { getArticles } from "@/lib/actualite";

export const metadata = {
  title: "Actualité — XBZ Esport",
  description: "Les dernières news, résultats et annonces de la structure XBZ Esport.",
};

export default async function ActualitePage() {
  const articles = await getArticles();

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Actualité
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Les news du club
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          Résultats, recrutement, annonces : tout ce qui fait vivre XBZ, au même endroit.
        </p>
      </header>

      <ActualiteList articles={articles} />
    </div>
  );
}
