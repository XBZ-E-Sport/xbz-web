// Catégories et rôles ouverts au recrutement.
// Source unique de vérité : utilisée par le formulaire (client) ET par la
// validation côté serveur (route API). Le bot Discord doit refléter ces
// mêmes valeurs. Modifie simplement ce fichier pour ajuster l'offre.

export type RecrutementCategory = "XBZ Staff" | "XBZ Esport";

export const recrutementRoles: Record<RecrutementCategory, string[]> = {
  "XBZ Staff": [
    "Modérateur",
    "Community Manager",
    "Graphiste",
    "Monteur",
    "Caster",
    "Développeur",
  ],
  "XBZ Esport": ["Joueur", "Coach", "Manager", "Recruteur"],
};

export const recrutementCategories = Object.keys(recrutementRoles) as RecrutementCategory[];

/** Vrai si le rôle existe bien dans la catégorie donnée. */
export function isValidRole(categorie: string, role: string): categorie is RecrutementCategory {
  const roles = recrutementRoles[categorie as RecrutementCategory];
  return Array.isArray(roles) && roles.includes(role);
}
