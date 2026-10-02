// Contrat entre les actions du back-office (serveur) et leur formulaire
// (AdminForm, navigateur). Module sans dépendance : importable des deux côtés.
//
// Pourquoi RENVOYER les erreurs plutôt que les lever : en production, Next
// remplace le message de toute erreur levée par une action serveur par un
// texte générique (il pourrait contenir des secrets). Le staff ne voyait donc
// jamais « Taille en double » ni « Commande déjà expédiée », seulement
// « Échec de l'enregistrement ». La doc Next prescrit de traiter les erreurs
// attendues comme des valeurs de retour : c'est ce que fait ce contrat.

/** Ce que renvoie une action : rien si tout va bien, sinon le message à afficher. */
export type AdminResult = { error: string } | undefined;

/** Une action du back-office, telle que la reçoit son formulaire. */
export type AdminAction = (formData: FormData) => Promise<AdminResult>;

/** Message affiché quand l'erreur n'est pas prévue (détail dans les logs serveur). */
export const ADMIN_GENERIC_ERROR = "Échec de l’enregistrement. Réessaie ou recharge la page.";

/**
 * Erreur ATTENDUE du back-office (saisie invalide, conflit, élément déjà
 * traité…) : son message, rédigé pour le staff, est affiché tel quel.
 * Toute autre erreur reste interne et donne le message générique.
 */
export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

/** Message d'échec porté par le résultat d'une action, ou null si c'est un succès. */
export function adminFailure(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("error" in result)) return null;
  const { error } = result as { error: unknown };
  return typeof error === "string" && error.trim() ? error : null;
}
