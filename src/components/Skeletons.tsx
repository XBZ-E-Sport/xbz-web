// Blocs de chargement (skeletons) : placeholders qui esquissent la structure
// d'une page/liste avant l'arrivée des données serveur (pages force-dynamic).
// `motion-safe:` → statiques si l'utilisateur a réduit les animations.

import { useTranslations } from "next-intl";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded bg-white/5 motion-safe:animate-pulse ${className}`} />;
}

/** Grille de cartes fantômes, calquée sur les listes (actualité, boutique, équipes). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-xbz flex flex-col gap-3 p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton complet d'une page-liste : en-tête + filtres (optionnels) + grille.
 * `role="status"` annonce le chargement aux lecteurs d'écran ; les blocs sont
 * `aria-hidden` (purement visuels).
 */
export function ListPageSkeleton({ count = 6, chips = true }: { count?: number; chips?: boolean }) {
  const t = useTranslations("common");
  return (
    <div
      role="status"
      aria-label={t("loading")}
      className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32"
    >
      <div className="mb-10 flex flex-col items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {chips && (
        <div aria-hidden="true" className="mb-8 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      )}

      <CardGridSkeleton count={count} />
    </div>
  );
}
