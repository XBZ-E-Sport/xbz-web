import { revalidatePath } from "next/cache";

// Cache de données (unstable_cache) pour les lectures publiques.
//
// Les requêtes publiques (articles, produits, équipes) sont mises en cache et
// PARTAGÉES entre toutes les requêtes/visiteurs, au lieu de taper la base à
// chaque affichage. Le back-office invalide le tag concerné via `revalidateTag`
// à chaque écriture → la fraîcheur reste immédiate après une modif.
//
// Le TTL est un filet de sécurité : même si une invalidation était oubliée, la
// donnée est de toute façon rafraîchie au bout de ce délai.
export const CACHE_TAGS = {
  articles: "articles",
  products: "products",
  equipes: "equipes",
} as const;

// Statiquement analysable (contrainte Next : pas d'expression type 60 * 60).
export const CACHE_TTL_SECONDS = 3600; // 1 h

/**
 * Invalide une page publique DANS LES DEUX LANGUES.
 *
 * Depuis le passage sous `[locale]`, `/equipes` n'est plus une route : les
 * vraies adresses sont `/fr/equipes` et `/en/equipes`. Un
 * `revalidatePath("/equipes")` ne correspond donc plus à rien et ne rafraîchit
 * rien — sans erreur, sans avertissement. Le back-office semblait fonctionner
 * uniquement parce que les pages étaient en `force-dynamic` : il n'y avait
 * aucun HTML en cache à invalider.
 *
 * On passe ici le MOTIF de route (`/[locale]/equipes`) avec `type: "page"` :
 * Next invalide alors toutes les pages qui correspondent, les deux langues en
 * un seul appel.
 *
 * @param path chemin SANS préfixe de langue, ex. "/equipes" ou "/actualite/mon-slug".
 */
export function revalidateLocalizedPath(path: string): void {
  revalidatePath(path === "/" ? "/[locale]" : `/[locale]${path}`, "page");
}
