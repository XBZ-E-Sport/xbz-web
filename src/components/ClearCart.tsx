"use client";

import { useEffect } from "react";

import { clearCart } from "@/lib/cart-store";

/** Vide le panier du navigateur une fois le paiement confirmé (page « Merci »). */
export default function ClearCart() {
  useEffect(() => {
    clearCart();
  }, []);
  return null;
}
