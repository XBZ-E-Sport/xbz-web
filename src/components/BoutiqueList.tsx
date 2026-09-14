"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

// Import de TYPES uniquement (erasé au build) : lib/boutique tire le client
// Supabase serveur (server-only) → un import de valeur ferait planter le bundle
// client. L'ordre des catégories est dérivé des clés de `categoryStyles`.
import type { Product, ProductCategory } from "@/lib/boutique";
// Action serveur : importée par référence (elle ne tire aucun code serveur dans
// le bundle client). Le clic « Acheter » la POST, elle crée la session Stripe
// et redirige vers le paiement hébergé.
import { createCheckoutSession } from "@/app/[locale]/boutique/actions";

// Nombre de produits ajoutés à chaque « page » (pagination / lazy loading).
const PAGE_SIZE = 6;

// « Tous » n'est pas une catégorie de la base : c'est le filtre « pas de filtre ».
type Filter = ProductCategory | "Tous";
type SortKey = "defaut" | "prix-asc" | "prix-desc";

const categoryStyles: Record<ProductCategory, string> = {
  Textile: "bg-xbz-blue/15 text-[#7fc8ff]",
  Accessoire: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff]",
  Gaming: "bg-[rgba(0,200,255,0.15)] text-[#7fe6ff]",
};

/** Prix en euros, formaté selon la langue (« 19,90 € » / « €19.90 »). */
function formatPrice(price: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

function ProductCard({ product, eager }: { product: Product; eager: boolean }) {
  const t = useTranslations("boutique");
  const tCat = useTranslations("productCategories");
  const locale = useLocale();
  // Une image qui ne charge pas laissait un cadre vide, définitivement : ni le
  // build ni le runtime ne s'en plaignent, seul l'œil le voit. Le fichier peut
  // être corrompu au stockage, supprimé du bucket, ou l'URL saisie à la main
  // peut être morte — dans les trois cas l'emoji de repli vaut mieux qu'un trou.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.image) && !imageFailed;

  return (
    <li className="card-xbz flex flex-col overflow-hidden">
      {/* Visuel : image produit si dispo, sinon emoji de repli */}
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-linear-to-br from-xbz-blue/20 to-xbz-cyan/10">
        {showImage ? (
          <Image
            src={product.image!}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            // Première rangée : chargement immédiat + préchargement dans le
            // <head>, au lieu du `lazy` par défaut de next/image. Les autres
            // cartes affichent un emoji, présent dès le premier octet de HTML —
            // une image en différé arrivait donc visiblement après elles.
            // Au-delà de la première rangée, `lazy` reste le bon choix : ces
            // cartes sont sous la ligne de flottaison.
            priority={eager}
            onError={() => setImageFailed(true)}
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
            {tCat(product.category)}
          </span>
          <span className="font-display text-lg font-bold text-white">
            {formatPrice(product.price, locale)}
          </span>
        </div>

        <h2 className="mt-3 font-display text-lg text-xbz-blue">{product.name}</h2>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
          {product.description}
        </p>

        <div className="mt-4">
          {product.available ? (
            // Achat sur le site : le formulaire POST l'action serveur, qui crée
            // la session Stripe et redirige vers le paiement hébergé. Aucun prix
            // ne transite — seul le slug part, le montant est relu en base.
            <form action={createCheckoutSession}>
              <input type="hidden" name="slug" value={product.slug} />
              <button
                type="submit"
                className="block w-full rounded-lg bg-xbz-blue px-4 py-2 text-center text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer"
              >
                {t("buyNow")}
              </button>
            </form>
          ) : (
            <span className="block rounded-lg border border-white/15 px-4 py-2 text-center text-sm font-semibold text-neutral-400">
              {t("comingSoon")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function BoutiqueList({ products }: { products: Product[] }) {
  const t = useTranslations("boutique");
  const tCat = useTranslations("productCategories");
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

  // Bannière de retour de paiement (erreur ou annulation). L'action serveur
  // redirige vers /boutique?erreur=… ou ?annule=1. La page étant statique (ISR),
  // on lit la query CÔTÉ CLIENT — pas via searchParams, qui serait vide au
  // build — puis on la retire de l'URL pour qu'un rafraîchissement ne la répète pas.
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    let msg: string | null = null;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("annule")) msg = t("errCancelled");
      else if (q.get("erreur")) {
        const map: Record<string, string> = {
          indisponible: t("errIndispo"),
          introuvable: t("errNotFound"),
          paiement: t("errPayment"),
        };
        msg = map[q.get("erreur") ?? ""] ?? t("errPayment");
      }
    } catch {
      // Pas d'accès à l'URL : pas de bannière, ce n'est pas grave.
    }
    if (!msg) return;
    // On retire la query pour qu'un rafraîchissement ne répète pas le message.
    window.history.replaceState(null, "", window.location.pathname);
    // Lecture unique de l'URL au montage puis report dans l'état : c'est
    // l'usage même d'un effet (synchroniser depuis un système externe). La règle
    // ne sait pas le distinguer d'un setState en cascade — d'où la désactivation
    // ciblée, sur cette ligne seulement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBanner(msg);
    // Clés `t` stables pour une langue donnée ; on ne relit qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {banner && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200"
        >
          {banner}
        </p>
      )}
      {/* Barre de contrôle : filtres + tri */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label={t("filterAria")} className="flex flex-wrap gap-2">
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
                {f === "Tous" ? t("filterAll") : tCat(f)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          <label htmlFor="boutique-sort" className="text-sm text-neutral-400">
            {t("sort")}
          </label>
          <select
            id="boutique-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border-0 bg-[#111] px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            <option value="defaut">{t("sortDefault")}</option>
            <option value="prix-asc">{t("sortPriceAsc")}</option>
            <option value="prix-desc">{t("sortPriceDesc")}</option>
          </select>
        </div>
      </div>

      {/* Annonce du nombre de résultats pour les lecteurs d'écran */}
      <p aria-live="polite" className="sr-only">
        {filter === "Tous"
          ? t("resultCount", { count: filteredSorted.length })
          : t("resultCountFiltered", {
              count: filteredSorted.length,
              category: tCat(filter),
            })}
      </p>

      {filteredSorted.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("emptyCategory")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product, i) => (
            // 3 colonnes au plus large : les trois premières cartes sont
            // visibles sans défiler.
            <ProductCard key={product.slug} product={product} eager={i < 3} />
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
            {t("loadMore")}
          </button>
        </div>
      )}
    </>
  );
}
