import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { lineKey } from "@/lib/cart";
import { CART_STORAGE_KEY, addToCart, clearCart, getCart, removeFromCart, setCartQuantity, useCart } from "@/lib/cart-store";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stored = () => JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]");

beforeEach(() => {
  clearCart();
  localStorage.clear();
});

describe("panier du navigateur", () => {
  it("ajoute, cumule et persiste dans le localStorage", () => {
    expect(addToCart(id(1))).toBe(1);
    expect(addToCart(id(1), 2)).toBe(2);
    expect(stored()).toEqual([{ variantId: id(1), quantity: 3 }]);
  });

  it("plafonne au stock fourni et à 10 pièces ; renvoie ce qui a vraiment été ajouté", () => {
    expect(addToCart(id(1), 5, 2)).toBe(2);
    expect(addToCart(id(1), 1, 2)).toBe(0);
    expect(addToCart(id(2), 50)).toBe(10);
    expect(getCart()).toEqual([
      { variantId: id(1), quantity: 2 },
      { variantId: id(2), quantity: 10 },
    ]);
  });

  it("refuse une 21e taille différente", () => {
    for (let i = 1; i <= 20; i += 1) addToCart(id(i));
    expect(addToCart(id(21))).toBe(0);
    expect(getCart()).toHaveLength(20);
  });

  it("modifie, retire, vide", () => {
    addToCart(id(1), 3);
    addToCart(id(2), 1);
    setCartQuantity(id(1), 1);
    removeFromCart(id(2));
    expect(getCart()).toEqual([{ variantId: id(1), quantity: 1 }]);
    setCartQuantity(id(1), 0);
    expect(getCart()).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("un stockage corrompu donne un panier vide, sans erreur", () => {
    localStorage.setItem(CART_STORAGE_KEY, "{pas du json");
    expect(getCart()).toEqual([]);
  });

  it("le hook suit les changements, y compris ceux d'un autre onglet", () => {
    const { result } = renderHook(() => useCart());
    expect(result.current).toEqual([]);
    act(() => {
      addToCart(id(1));
    });
    expect(result.current).toEqual([{ variantId: id(1), quantity: 1 }]);
    // Un autre onglet écrit directement dans le stockage puis émet « storage ».
    act(() => {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ variantId: id(2), quantity: 4 }]));
      window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY }));
    });
    expect(result.current).toEqual([{ variantId: id(2), quantity: 4 }]);
  });

  it("renvoie la même référence tant que rien ne change (sinon React boucle)", () => {
    addToCart(id(1));
    expect(getCart()).toBe(getCart());
  });
});

describe("panier du navigateur : articles personnalisés", () => {
  const martin = { name: "MARTIN", number: "10" };

  it("même taille, texte différent : deux lignes ; même texte : une ligne cumulée", () => {
    addToCart(id(1), 1, 5);
    addToCart(id(1), 1, 5, martin);
    addToCart(id(1), 1, 5, martin);
    expect(getCart()).toEqual([
      { variantId: id(1), quantity: 1 },
      { variantId: id(1), quantity: 2, print: martin },
    ]);
    expect(stored()).toEqual(getCart());
  });

  it("le stock se compte PAR TAILLE, toutes lignes confondues", () => {
    expect(addToCart(id(1), 2, 3)).toBe(2);
    expect(addToCart(id(1), 2, 3, martin)).toBe(1);
    expect(addToCart(id(1), 1, 3, { name: "AUTRE" })).toBe(0);
    expect(getCart().reduce((n, l) => n + l.quantity, 0)).toBe(3);
  });

  it("le plafond de 20 lignes compte aussi les lignes personnalisées", () => {
    for (let i = 1; i <= 19; i += 1) addToCart(id(i));
    expect(addToCart(id(1), 1, 10, martin)).toBe(1);
    expect(addToCart(id(1), 1, 10, { name: "AUTRE" })).toBe(0);
    expect(getCart()).toHaveLength(20);
  });

  it("modifier / retirer une ligne par sa clé, sans toucher aux autres lignes de la taille", () => {
    addToCart(id(1), 2, 10);
    addToCart(id(1), 3, 10, martin);
    const key = lineKey({ variantId: id(1), print: martin });
    setCartQuantity(key, 1);
    expect(getCart()).toEqual([
      { variantId: id(1), quantity: 2 },
      { variantId: id(1), quantity: 1, print: martin },
    ]);
    removeFromCart(key);
    expect(getCart()).toEqual([{ variantId: id(1), quantity: 2 }]);
  });

  it("augmenter une ligne ne dépasse jamais 10 pièces pour la taille", () => {
    addToCart(id(1), 7, 10);
    addToCart(id(1), 2, 10, martin);
    setCartQuantity(lineKey({ variantId: id(1), print: martin }), 9);
    expect(getCart()[1].quantity).toBe(3);
  });

  it("une clé inconnue ne change rien", () => {
    addToCart(id(1), 1);
    setCartQuantity("inconnue", 5);
    expect(getCart()).toEqual([{ variantId: id(1), quantity: 1 }]);
  });
});
