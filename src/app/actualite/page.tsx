import Link from "next/link";

import { getArticles, type Article, type ArticleCategory } from "@/lib/actualite";

export const metadata = {
  title: "Actualité — XBZ Esport",
  description: "Les dernières news, résultats et annonces de la structure XBZ Esport.",
};

const categoryStyles: Record<ArticleCategory, string> = {
  Compétition: "bg-xbz-blue/15 text-[#7fc8ff]",
  Recrutement: "bg-[rgba(0,200,255,0.15)] text-[#7fe6ff]",
  Annonce: "bg-white/10 text-white",
  Communauté: "bg-[rgba(88,101,242,0.18)] text-[#b6bdff]",
  Création: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff]",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function CategoryBadge({ category }: { category: ArticleCategory }) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${categoryStyles[category]}`}
    >
      {category}
    </span>
  );
}

export default async function ActualitePage() {
  const articles = await getArticles();
  const [featured, ...rest] = articles;

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

      {articles.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">
          Aucune actualité pour le moment. Reviens bientôt !
        </p>
      ) : (
        <>
          <section aria-labelledby="une-heading" className="mb-14">
            <h2 id="une-heading" className="sr-only">
              À la une
            </h2>
            <Link
              href={`/actualite/${featured.slug}`}
              className="card-xbz group block p-8 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1 sm:p-10"
            >
              <div className="flex flex-wrap items-center gap-3">
                <CategoryBadge category={featured.category} />
                <time dateTime={featured.date} className="text-sm text-neutral-500">
                  {formatDate(featured.date)}
                </time>
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
                {featured.title}
              </h3>
              <p className="mt-3 max-w-3xl leading-relaxed text-neutral-300">{featured.excerpt}</p>
              <span className="mt-5 inline-flex items-center gap-1 font-semibold text-xbz-cyan">
                Lire l’article
                <span aria-hidden="true" className="transition-transform duration-300 motion-safe:group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          </section>

          {rest.length > 0 && (
            <section aria-labelledby="autres-heading">
              <h2
                id="autres-heading"
                className="mb-6 font-display text-xl font-bold tracking-[2px] text-neutral-300"
              >
                PLUS D’ACTUALITÉS
              </h2>
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <li>
      <Link
        href={`/actualite/${article.slug}`}
        className="card-xbz group flex h-full flex-col p-6 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={article.category} />
          <time dateTime={article.date} className="text-xs text-neutral-500">
            {formatDate(article.date)}
          </time>
        </div>
        <h3 className="mt-3 font-display text-lg text-xbz-blue">{article.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-400">{article.excerpt}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-xbz-cyan">
          Lire l’article
          <span aria-hidden="true" className="transition-transform duration-300 motion-safe:group-hover:translate-x-1">
            →
          </span>
        </span>
      </Link>
    </li>
  );
}
