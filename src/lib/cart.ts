// Règles du panier, partagées par le navigateur (src/lib/cart-store.ts) et par
// le serveur (route de paiement) : un seul endroit dit ce qu'est un panier
// valide. Aucune dépendance serveur ni navigateur : importable partout.
//
// Le panier ne contient QUE des identifiants de taille, des quantités et, pour un
// article personnalisé, le nom / numéro à imprimer — jamais un prix ni un nom de
// produit. Ce qui s'affiche vient du catalogue, ce qui se paie (supplément de
// personnalisation compris) est recalculé en base au moment du paiement.

import { parsePrint, printKey, type Print } from "@/lib/personalization";

/**
 * Une ligne du panier : une taille d'un produit (`variantId`), sa quantité et,
 * le cas échéant, la personnalisation. Deux textes différents sur la même taille
 * font deux lignes (donc deux articles), un même texte une seule.
 */
export type CartLine = { variantId: string; quantity: number; print?: Print };

/** Identité d'une ligne : la taille seule, ou la taille et son texte imprimé. */
export function lineKey(line: Pick<CartLine, "variantId" | "print">): string {
  return line.print ? `${line.variantId}|${printKey(line.print)}` : line.variantId;
}

/** Lignes au plus (tailles ou personnalisations différentes) — même borne côté base. */
export const CART_MAX_LINES = 20;
/** Pièces au plus par TAILLE, personnalisations confondues — même borne côté base. */
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
  const merged = new Map<string, CartLine>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { variantId, quantity, print: rawPrint } = item as Record<string, unknown>;
    if (!isVariantId(variantId)) continue;
    const q = typeof quantity === "number" && Number.isFinite(quantity) ? Math.floor(quantity) : 0;
    if (q < 1) continue;
    // Personnalisation illisible : la ligne est écartée (on ne la vendrait pas sans son texte).
    const print = parsePrint(rawPrint);
    if (print === null) continue;
    const id = variantId.toLowerCase();
    const line: CartLine = print ? { variantId: id, quantity: q, print } : { variantId: id, quantity: q };
    const key = lineKey(line);
    const known = merged.get(key);
    merged.set(key, known ? { ...known, quantity: Math.min(CART_MAX_QUANTITY, known.quantity + q) } : { ...line, quantity: Math.min(CART_MAX_QUANTITY, q) });
  }
  // Au plus 10 pièces PAR TAILLE, toutes personnalisations confondues (même borne
  // que la base) : les dernières lignes sont rognées, jamais les premières.
  const used = new Map<string, number>();
  const out: CartLine[] = [];
  for (const line of merged.values()) {
    const room = CART_MAX_QUANTITY - (used.get(line.variantId) ?? 0);
    const quantity = Math.min(line.quantity, room);
    if (quantity < 1) continue;
    used.set(line.variantId, (used.get(line.variantId) ?? 0) + quantity);
    out.push({ ...line, quantity });
  }
  return out.slice(0, CART_MAX_LINES);
}

/**
 * Panier reçu par le SERVEUR : strict. Tout ce qui n'est pas exactement un
 * panier valide est refusé (null), plutôt que corrigé en silence — on ne fait
 * pas payer autre chose que ce que le client croit acheter.
 */
export function parseCheckoutLines(raw: unknown): CartLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > CART_MAX_LINES) return null;
  const seen = new Set<string>();
  const perVariant = new Map<string, number>();
  const lines: CartLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { variantId, quantity, print: rawPrint } = item as Record<string, unknown>;
    if (!isVariantId(variantId)) return null;
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > CART_MAX_QUANTITY) return null;
    // Personnalisation demandée mais invalide : refus net (null), pas de correction.
    const print = parsePrint(rawPrint);
    if (print === null) return null;
    const id = variantId.toLowerCase();
    const line: CartLine = print ? { variantId: id, quantity: quantity as number, print } : { variantId: id, quantity: quantity as number };
    const key = lineKey(line);
    if (seen.has(key)) return null;
    seen.add(key);
    const total = (perVariant.get(id) ?? 0) + (quantity as number);
    if (total > CART_MAX_QUANTITY) return null;
    perVariant.set(id, total);
    lines.push(line);
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
