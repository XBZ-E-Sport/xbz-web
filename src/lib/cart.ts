// Règles du panier, partagées par le navigateur (src/lib/cart-store.ts) et par
// le serveur (route de paiement) : un seul endroit dit ce qu'est un panier
// valide. Aucune dépendance serveur ni navigateur : importable partout.
//
// Le panier ne contient QUE des identifiants de taille et des quantités —
// jamais un prix ni un nom. Ce qui s'affiche vient du catalogue, ce qui se
// paie est recalculé en base au moment du paiement.

/** Une ligne du panier : une taille d'un produit (`variantId`) et sa quantité. */
export type CartLine = { variantId: string; quantity: number };

/** Lignes au plus (tailles différentes) — même borne côté base. */
export const CART_MAX_LINES = 20;
/** Pièces au plus par ligne — même borne côté base. */
export const CART_MAX_QUANTITY = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVariantId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * Panier NETTOYÉ, pour ce que le navigateur relit de son stockage : lignes
 * illisibles écartées, doublons fusionnés, quantités ramenées dans 1..10, au
 * plus 20 lignes. Un stockage abîmé ou bricolé à la main donne un panier
 * valide, jamais une erreur.
 */
export function sanitizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { variantId, quantity } = item as Record<string, unknown>;
    if (!isVariantId(variantId)) continue;
    const q = typeof quantity === "number" && Number.isFinite(quantity) ? Math.floor(quantity) : 0;
    if (q < 1) continue;
    const id = variantId.toLowerCase();
    merged.set(id, Math.min(CART_MAX_QUANTITY, (merged.get(id) ?? 0) + q));
  }
  return [...merged.entries()]
    .slice(0, CART_MAX_LINES)
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Panier reçu par le SERVEUR : strict. Tout ce qui n'est pas exactement un
 * panier valide est refusé (null), plutôt que corrigé en silence — on ne fait
 * pas payer autre chose que ce que le client croit acheter.
 */
export function parseCheckoutLines(raw: unknown): CartLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > CART_MAX_LINES) return null;
  const seen = new Set<string>();
  const lines: CartLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { variantId, quantity } = item as Record<string, unknown>;
    if (!isVariantId(variantId)) return null;
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > CART_MAX_QUANTITY) return null;
    const id = variantId.toLowerCase();
    if (seen.has(id)) return null;
    seen.add(id);
    lines.push({ variantId: id, quantity: quantity as number });
  }
  return lines;
}

/**
 * Cookie LISIBLE par la page (pas httpOnly, aucun secret) : « ce navigateur a
 * ouvert une page de paiement ». Le panier, en le voyant, rend d'abord la
 * réservation de ce navigateur — sinon ses propres articles réservés
 * s'afficheraient épuisés après un retour arrière depuis Stripe. L'identifiant
 * de la commande, lui, reste dans le cookie httpOnly de la route de paiement.
 */
export const CHECKOUT_OPEN_COOKIE = "xbz_checkout_open";

/** Nombre total de pièces (pastille de l'en-tête). */
export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}
