import "server-only";

import { unstable_rethrow } from "next/navigation";

import { ADMIN_GENERIC_ERROR, AdminError, type AdminResult } from "@/lib/admin-result";

// Exécution des actions du back-office : erreurs attendues renvoyées au
// formulaire (message lisible), erreurs imprévues journalisées côté serveur et
// résumées par un message générique. Voir src/lib/admin-result.ts.

/**
 * Exécute le corps d'une action et convertit ses erreurs en résultat :
 *   - `AdminError`      → `{ error: message }`, affiché tel quel au staff ;
 *   - redirect(), notFound()… → relancées : Next doit les traiter (session
 *     expirée → page de connexion) ;
 *   - toute autre erreur → journalisée, `{ error: message générique }`.
 */
export async function adminAction(run: () => Promise<unknown>): Promise<AdminResult> {
  try {
    await run();
    return undefined;
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AdminError) return { error: e.message };
    console.error("[admin] action:", e);
    return { error: ADMIN_GENERIC_ERROR };
  }
}

type DbError = { code?: string | null; message: string };

/**
 * Erreur Postgres/PostgREST → erreur pour le staff quand la cause est
 * compréhensible (doublon, lien cassé, valeur refusée), sinon erreur interne
 * (message générique, détail dans les logs). `duplicate` précise le doublon
 * (« Un produit avec ce slug existe déjà. »).
 */
export function dbError(error: DbError, duplicate?: string): Error {
  switch (error.code) {
    case "23505":
      return new AdminError(duplicate ?? "Cet élément existe déjà (valeur en double).");
    case "23503":
      return new AdminError(
        /update or delete/i.test(error.message)
          ? "Suppression impossible : d’autres éléments y sont encore rattachés."
          : "Un élément lié n’existe plus (supprimé entre-temps ?). Recharge la page puis recommence.",
      );
    case "23502":
      return new AdminError("Un champ obligatoire est vide.");
    case "23514":
      return new AdminError("Une valeur est hors des limites autorisées.");
    case "22001":
      return new AdminError("Un texte est trop long.");
    case "42703":
    case "PGRST204":
      return new AdminError(
        "La base n’est pas à jour (une migration Supabase n’a pas été exécutée). Préviens la personne qui gère le site.",
      );
    case "22P02":
    case "22007":
    case "22008":
      return new AdminError("Une valeur n’a pas le format attendu (nombre, date…).");
    default:
      return new Error(`[db ${error.code ?? "?"}] ${error.message}`);
  }
}
