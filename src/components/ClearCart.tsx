"use client";

import { useEffect } from "react";

import { CHECKOUT_OPEN_COOKIE, PAYMENT_TAB_KEY } from "@/lib/cart";
import { clearCart } from "@/lib/cart-store";

/**
 * Vide le panier du navigateur une fois le paiement confirmé (page « Merci »), et oublie
 * le paiement ouvert : sans quoi un autre onglet (ou le panier rouvert plus tard) croirait
 * un paiement encore en cours.
 */
export default function ClearCart() {
  useEffect(() => {
    clearCart();
    try {
      document.cookie = `${CHECKOUT_OPEN_COOKIE}=; max-age=0; path=/`;
      sessionStorage.removeItem(PAYMENT_TAB_KEY);
    } catch {
      /* cookies ou stockage bloqués : rien à oublier */
    }
  }, []);
  return null;
}
