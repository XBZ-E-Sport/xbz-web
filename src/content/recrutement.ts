// Catégories et rôles ouverts au recrutement.
//
// La disponibilité n'est PAS gérée ici : elle est dérivée directement des
// effectifs (`content/staff.ts` et `content/esport.ts`). Chaque ligne
// d'effectif porte un champ `slots` ("rempli/total", ex: "1/4") et un champ
// `recrute` qui indique le rôle candidat qu'elle alimente.
//
// Règle : un rôle est proposé au candidat UNIQUEMENT s'il reste au moins un
// slot libre (rempli < total). Le staff n'a donc qu'un seul endroit à tenir à
// jour — l'effectif — et le recrutement suit automatiquement.
// Source unique utilisée par le formulaire (client) ET la validation serveur.

import { staffRoster } from "./staff";
import { esportRoster } from "./esport";

export type RecrutementCategory = "XBZ Staff" | "XBZ Esport";

export const recrutementCategories: RecrutementCategory[] = ["XBZ Staff", "XBZ Esport"];

// Effectif de référence pour chaque catégorie de recrutement.
const rosterByCategory: Record<RecrutementCategory, { recrute?: string; slots: string }[]> = {
  "XBZ Staff": staffRoster,
  "XBZ Esport": esportRoster,
};

/** Nombre de places libres à partir d'un slot "rempli/total" (ex: "1/4" → 3). */
function freeSlots(slots: string): number {
  const [filled, total] = slots.split("/").map((n) => Number.parseInt(n.trim(), 10));
  if (Number.isNaN(filled) || Number.isNaN(total)) return 0;
  return Math.max(0, total - filled);
}

export type RecrutementRole = {
  name: string;
  /** Total de places libres pour ce rôle (agrégé si plusieurs effectifs). */
  free: number;
};

/**
 * Rôles avec de la disponibilité pour une catégorie donnée.
 * On parcourt l'effectif, on ne garde que les lignes `recrute` ayant au moins
 * un slot libre, et on agrège (ex: plusieurs rosters "Joueur" → une entrée).
 */
export function openRoles(categorie: string): RecrutementRole[] {
  const roster = rosterByCategory[categorie as RecrutementCategory];
  if (!roster) return [];

  const freeByRole = new Map<string, number>();
  for (const entry of roster) {
    if (!entry.recrute) continue; // ligne non ouverte au recrutement
    const free = freeSlots(entry.slots);
    if (free <= 0) continue; // complet → pas de disponibilité
    freeByRole.set(entry.recrute, (freeByRole.get(entry.recrute) ?? 0) + free);
  }

  return [...freeByRole].map(([name, free]) => ({ name, free }));
}

/** Vrai si le rôle existe ET a encore de la disponibilité dans la catégorie. */
export function isValidRole(categorie: string, role: string): categorie is RecrutementCategory {
  return openRoles(categorie).some((r) => r.name === role);
}
