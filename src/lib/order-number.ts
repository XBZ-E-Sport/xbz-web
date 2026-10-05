// Numéro de commande lisible (reçu, e-mails, back-office, formulaire de rétractation).
// Module à part, sans dépendance : importable partout sans tirer le reste de la boutique.
export function orderNumber(id: string): string {
  return `XBZ-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
