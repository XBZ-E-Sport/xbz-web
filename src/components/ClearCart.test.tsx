import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import ClearCart from "@/components/ClearCart";
import { CART_STORAGE_KEY } from "@/lib/cart-store";

afterEach(cleanup);

describe("ClearCart (page « Merci »)", () => {
  it("vide le panier ET oublie le paiement ouvert (cookie témoin et jeton de l'onglet)", () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ variantId: "v", quantity: 1 }]));
    document.cookie = "xbz_checkout_open=tok-1; path=/";
    sessionStorage.setItem("xbz-checkout-tab", "tok-1");
    render(<ClearCart />);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]")).toEqual([]);
    expect(document.cookie).not.toContain("xbz_checkout_open=tok-1");
    expect(sessionStorage.getItem("xbz-checkout-tab")).toBeNull();
  });
});
