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
