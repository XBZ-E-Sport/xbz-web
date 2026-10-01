// Panier du NAVIGATEUR : gardé dans le localStorage de ce visiteur, partagé
// entre ses onglets, lu par React via `useSyncExternalStore`.
//
// Un panier n'a rien à faire sur le serveur tant qu'on ne paie pas : il ne
// contient que des identifiants de taille et des quantités (voir
// src/lib/cart.ts). Si le stockage est indisponible (navigation privée
// stricte, quota), le panier vit en mémoire le temps de l'onglet — la boutique
// marche quand même.

import { useSyncExternalStore } from "react";

import { CART_MAX_LINES, CART_MAX_QUANTITY, sanitizeCart, type CartLine } from "@/lib/cart";

export const CART_STORAGE_KEY = "xbz-cart-v1";

const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();

// Dernière valeur lue : `useSyncExternalStore` exige la MÊME référence tant
// que rien n'a changé, sinon il boucle.
let snapshot: { raw: string | null; lines: CartLine[] } = { raw: null, lines: EMPTY };
let memoryOnly = false;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): CartLine[] {
  if (memoryOnly) return snapshot.lines;
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(CART_STORAGE_KEY) ?? null;
  } catch {
    return snapshot.lines;
  }
  if (raw === snapshot.raw) return snapshot.lines;
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const lines = sanitizeCart(parsed);
  snapshot = { raw, lines: lines.length ? lines : EMPTY };
  return snapshot.lines;
}

function write(lines: CartLine[]): void {
  const clean = sanitizeCart(lines);
  const raw = JSON.stringify(clean);
  try {
    const s = storage();
    if (!s) throw new Error("pas de stockage");
    if (clean.length) s.setItem(CART_STORAGE_KEY, raw);
    else s.removeItem(CART_STORAGE_KEY);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  snapshot = { raw: clean.length ? raw : null, lines: clean.length ? clean : EMPTY };
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  // Un autre onglet a modifié le panier.
  if (e.key === CART_STORAGE_KEY || e.key === null) for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** Lignes du panier. Vide au rendu serveur et pendant l'hydratation. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function getCart(): CartLine[] {
  return read();
}

/**
 * Ajoute des pièces d'une taille. Renvoie la quantité réellement ajoutée :
 * moins que demandé si la ligne atteint `max` (le stock affiché, 10 au plus),
 * 0 si le panier a déjà 20 tailles différentes.
 */
export function addToCart(variantId: string, quantity = 1, max = CART_MAX_QUANTITY): number {
  const lines = read();
  const existing = lines.find((l) => l.variantId === variantId);
  if (!existing && lines.length >= CART_MAX_LINES) return 0;
  const before = existing?.quantity ?? 0;
  const after = Math.max(before, Math.min(CART_MAX_QUANTITY, max, before + quantity));
  if (after === before) return 0;
  write(existing ? lines.map((l) => (l.variantId === variantId ? { ...l, quantity: after } : l)) : [...lines, { variantId, quantity: after }]);
  return after - before;
}

/** Fixe la quantité d'une ligne (0 la retire). */
export function setCartQuantity(variantId: string, quantity: number): void {
  const q = Math.max(0, Math.min(CART_MAX_QUANTITY, Math.floor(quantity)));
  const lines = read();
  write(q === 0 ? lines.filter((l) => l.variantId !== variantId) : lines.map((l) => (l.variantId === variantId ? { ...l, quantity: q } : l)));
}

export function removeFromCart(variantId: string): void {
  setCartQuantity(variantId, 0);
}

export function clearCart(): void {
  write([]);
}
