// Catégories de recrutement (structure, pas de données d'effectif ici).
// Les rôles ouverts sont dérivés de la BDD → voir lib/equipes.ts.

export type RecrutementCategory = "XBZ Staff" | "XBZ Esport";

export const recrutementCategories: RecrutementCategory[] = ["XBZ Staff", "XBZ Esport"];

/**
 * Âge minimum requis selon la catégorie : 18 ans pour le staff (majeur),
 * 16 ans sinon. Règle partagée client (formulaire) + serveur (API).
 */
export function minAgeForCategory(categorie: string): number {
  return categorie === "XBZ Staff" ? 18 : 16;
}
