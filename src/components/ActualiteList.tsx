"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { Article, ArticleCategory } from "@/lib/actualite";
import { formatDate, articleCategoryStyles } from "@/lib/format";

// Nombre d'articles ajoutés à chaque « page » (pagination / lazy loading).
const PAGE_SIZE = 6;

type SortKey = "recent" | "ancien";
type Filter = ArticleCategory | "Tous";

function CategoryBadge({ category }: { category: ArticleCategory }) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${articleCategoryStyles[category]}`}
    >
      {category}
    </span>
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

export default function ActualiteList({ articles }: { articles: Article[] }) {
  const [filter, setFilter] = useState<Filter>("Tous");
  const [sort, setSort] = useState<SortKey>("recent");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [prevViewKey, setPrevViewKey] = useState("Tous|recent");

  // Catégories réellement présentes dans les articles (+ « Tous »).
  const filters = useMemo<Filter[]>(() => {
    const present = new Set(articles.map((a) => a.category));
    return ["Tous", ...(Object.keys(articleCategoryStyles) as ArticleCategory[]).filter((c) => present.has(c))];
  }, [articles]);

  const filteredSorted = useMemo(() => {
    const list = filter === "Tous" ? articles : articles.filter((a) => a.category === filter);
    return [...list].sort((a, b) =>
      sort === "recent" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    );
  }, [articles, filter, sort]);

  // On repart de la 1re page dès qu'on change de filtre ou de tri.
  // Pattern React recommandé : ajuster l'état pendant le rendu plutôt qu'en effet.
  const viewKey = `${filter}|${sort}`;
  if (prevViewKey !== viewKey) {
    setPrevViewKey(viewKey);
    setVisible(PAGE_SIZE);
  }

  const shown = filteredSorted.slice(0, visible);
  const hasMore = visible < filteredSorted.length;

  // Lazy loading : charge la page suivante quand la sentinelle approche du viewport.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => v + PAGE_SIZE);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  const chipBase =
    "rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline-none";
  const chipActive = "bg-linear-to-r from-xbz-cyan to-xbz-blue text-[#04141f]";
  const chipIdle = "border border-white/15 text-neutral-300 hover:border-white/40 hover:text-white";

  return (
    <>
      {/* Barre de contrôle : filtres + tri */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filtrer par catégorie" className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f)}
                className={`${chipBase} ${active ? chipActive : chipIdle}`}
              >
                {f}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          <label htmlFor="actu-sort" className="text-sm text-neutral-400">
            Trier
          </label>
          <select
            id="actu-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border-0 bg-[#111] px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            <option value="recent">Plus récent</option>
            <option value="ancien">Plus ancien</option>
          </select>
        </div>
      </div>

      {/* Annonce du nombre de résultats pour les lecteurs d'écran */}
      <p aria-live="polite" className="sr-only">
        {filteredSorted.length} article{filteredSorted.length > 1 ? "s" : ""}
        {filter !== "Tous" ? ` dans la catégorie ${filter}` : ""}.
      </p>

      {filteredSorted.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">
          Aucune actualité dans cette catégorie pour le moment.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </ul>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-xl border border-white/25 px-7 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
          >
            Charger plus d’actualités
          </button>
        </div>
      )}
    </>
  );
}
