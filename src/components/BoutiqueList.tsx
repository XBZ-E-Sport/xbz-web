"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

// Import de TYPES uniquement (erasé au build) : lib/boutique tire le client
// Supabase serveur (server-only) → un import de valeur ferait planter le bundle
// client. L'ordre des catégories est dérivé des clés de `categoryStyles`.
import type { Product, ProductCategory } from "@/lib/boutique";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";

// Nombre de produits ajoutés à chaque « page » (pagination / lazy loading).
const PAGE_SIZE = 6;

type Filter = ProductCategory | "Tous";
type SortKey = "defaut" | "prix-asc" | "prix-desc";

const categoryStyles: Record<ProductCategory, string> = {
  Textile: "bg-xbz-blue/15 text-[#7fc8ff]",
  Accessoire: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff]",
  Gaming: "bg-[rgba(0,200,255,0.15)] text-[#7fe6ff]",
};

const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function ProductCard({ product }: { product: Product }) {
  return (
    <li className="card-xbz flex flex-col overflow-hidden">
      {/* Visuel : image produit si dispo, sinon emoji de repli */}
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-linear-to-br from-xbz-blue/20 to-xbz-cyan/10">
        {product.image ? (
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span aria-hidden="true" className="text-6xl">
            {product.icon}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${categoryStyles[product.category]}`}
          >
            {product.category}
          </span>
          <span className="font-display text-lg font-bold text-white">
            {priceFormatter.format(product.price)}
          </span>
        </div>

        <h3 className="mt-3 font-display text-lg text-xbz-blue">{product.name}</h3>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
          {product.description}
        </p>

        <div className="mt-4">
          {product.available ? (
            // Achetable : lien d'achat externe s'il existe, sinon commande via Discord.
            <a
              href={product.url || DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-xbz-blue px-4 py-2 text-center text-sm font-bold text-white transition hover:brightness-110"
            >
              {product.url ? "Acheter" : "Commander sur Discord"}
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          ) : (
            <span className="block rounded-lg border border-white/15 px-4 py-2 text-center text-sm font-semibold text-neutral-400">
              Bientôt disponible
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function BoutiqueList({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<Filter>("Tous");
  const [sort, setSort] = useState<SortKey>("defaut");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [prevViewKey, setPrevViewKey] = useState("Tous|defaut");

  // Catégories réellement présentes dans le catalogue (+ « Tous »).
  const filters = useMemo<Filter[]>(() => {
    const present = new Set(products.map((p) => p.category));
    const ordered = Object.keys(categoryStyles) as ProductCategory[];
    return ["Tous", ...ordered.filter((c) => present.has(c))];
  }, [products]);

  const filteredSorted = useMemo(() => {
    const list = filter === "Tous" ? products : products.filter((p) => p.category === filter);
    if (sort === "defaut") return list; // ordre du back-office (position)
    return [...list].sort((a, b) => (sort === "prix-asc" ? a.price - b.price : b.price - a.price));
  }, [products, filter, sort]);

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
          <label htmlFor="boutique-sort" className="text-sm text-neutral-400">
            Trier
          </label>
          <select
            id="boutique-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border-0 bg-[#111] px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            <option value="defaut">Par défaut</option>
            <option value="prix-asc">Prix croissant</option>
            <option value="prix-desc">Prix décroissant</option>
          </select>
        </div>
      </div>

      {/* Annonce du nombre de résultats pour les lecteurs d'écran */}
      <p aria-live="polite" className="sr-only">
        {filteredSorted.length} produit{filteredSorted.length > 1 ? "s" : ""}
        {filter !== "Tous" ? ` dans la catégorie ${filter}` : ""}.
      </p>

      {filteredSorted.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">
          Aucun produit dans cette catégorie pour le moment.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product) => (
            <ProductCard key={product.slug} product={product} />
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
            Charger plus de produits
          </button>
        </div>
      )}
    </>
  );
}
