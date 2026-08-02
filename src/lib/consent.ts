// Consentement RGPD : un utilisateur doit accepter explicitement le traitement
// de ses données avant d'envoyer un formulaire public (recrutement, support).
//
// Une case à cocher HTML transmet la valeur "on" quand elle est cochée (et rien
// quand elle ne l'est pas). On accepte aussi les formes booléennes / JSON par
// robustesse. À valider CÔTÉ SERVEUR : les routes API sont joignables
// directement, on ne se repose jamais sur la seule validation du navigateur.
export function hasConsent(value: unknown): boolean {
  return value === true || value === "on" || value === "true" || value === "1";
}
