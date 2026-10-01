// Montants en euros, formatés selon la langue (« 19,90 € » / « €19.90 »).
// Sans dépendance : importable côté serveur comme dans un composant client.

export function formatEuros(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
