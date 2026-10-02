// Helpers d'affichage partagés (client-safe : n'importe que des types).
import type { ArticleCategory } from "@/lib/actualite";
import type { ProductCategory } from "@/lib/boutique";

/**
 * Date ISO → format long, fuseau Paris (ex: "14 juillet 2026", "July 14, 2026").
 *
 * Le fuseau reste Paris quelle que soit la langue : le club est français, une
 * annonce datée du 14 juillet doit afficher le 14 juillet pour tout le monde.
 */
export function formatDate(iso: string, locale = "fr"): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Teinte de chaque catégorie d'article, dans la charte : rouge, jaune ou neutre.
 * Source unique des badges du site ET du sur-titre des bannières de partage.
 */
export const articleCategoryTone = {
  Compétition: "red",
  Recrutement: "yellow",
  Annonce: "neutral",
  Communauté: "yellow",
  Création: "red",
} as const satisfies Record<ArticleCategory, "red" | "yellow" | "neutral">;

/**
 * Badge de catégorie (source unique). Deux couleurs seulement : chaque teinte
 * existe en plein (fond teinté) et en liseré (anneau intérieur, sans décalage
 * de taille), ce qui garde les cinq catégories distinctes.
 * L'ordre des clés est celui des filtres de la page Actualité.
 */
export const articleCategoryStyles: Record<ArticleCategory, string> = {
  Compétition: "bg-xbz-blue/15 text-[#f4a79b]",
  Recrutement: "bg-[rgba(252,205,5,0.15)] text-[#ffd964]",
  Annonce: "bg-white/10 text-white",
  Communauté: "ring-1 ring-inset ring-xbz-cyan/50 text-[#ffd964]",
  Création: "ring-1 ring-inset ring-xbz-blue/70 text-[#f4a79b]",
};

/**
 * Badge de catégorie d'un produit (liste de la boutique ET page produit) :
 * mêmes couleurs de la charte que les badges d'article. L'ordre des clés est
 * celui des filtres de la boutique.
 */
export const productCategoryStyles: Record<ProductCategory, string> = {
  Textile: "bg-xbz-blue/15 text-[#f4a79b]",
  Accessoire: "ring-1 ring-inset ring-xbz-cyan/50 text-[#ffd964]",
  Gaming: "bg-[rgba(252,205,5,0.15)] text-[#ffd964]",
};
