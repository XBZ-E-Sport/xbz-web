import { describe, it, expect } from "vitest";

import { CART_MAX_LINES, CART_MAX_QUANTITY, cartCount, parseCheckoutLines, sanitizeCart } from "@/lib/cart";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("sanitizeCart (stockage du navigateur)", () => {
  it("garde un panier valide tel quel", () => {
    expect(sanitizeCart([{ variantId: id(1), quantity: 2 }])).toEqual([{ variantId: id(1), quantity: 2 }]);
  });

  it("transforme un stockage abîmé en panier valide, jamais en erreur", () => {
    expect(sanitizeCart(null)).toEqual([]);
    expect(sanitizeCart("n'importe quoi")).toEqual([]);
    expect(sanitizeCart([null, 3, { variantId: "pas-un-uuid", quantity: 1 }, { variantId: id(1) }, { variantId: id(2), quantity: -4 }])).toEqual([]);
  });

  it("fusionne les doublons, plafonne à 10 pièces et 20 lignes", () => {
    expect(sanitizeCart([{ variantId: id(1), quantity: 7 }, { variantId: id(1).toUpperCase(), quantity: 7 }])).toEqual([
      { variantId: id(1), quantity: CART_MAX_QUANTITY },
    ]);
    const many = Array.from({ length: 25 }, (_, i) => ({ variantId: id(i + 1), quantity: 1 }));
    expect(sanitizeCart(many)).toHaveLength(CART_MAX_LINES);
    expect(sanitizeCart([{ variantId: id(1), quantity: 2.9 }])).toEqual([{ variantId: id(1), quantity: 2 }]);
  });

  it("ne garde QUE taille et quantité (un prix glissé dans le stockage disparaît)", () => {
    expect(sanitizeCart([{ variantId: id(1), quantity: 1, price: 0.01, name: "x" }])).toEqual([{ variantId: id(1), quantity: 1 }]);
  });
});

describe("parseCheckoutLines (serveur, strict)", () => {
  it("accepte un panier exact", () => {
    expect(parseCheckoutLines([{ variantId: id(1), quantity: 3 }])).toEqual([{ variantId: id(1), quantity: 3 }]);
  });

  it.each([
    ["vide", []],
    ["pas une liste", { variantId: id(1), quantity: 1 }],
    ["quantité 0", [{ variantId: id(1), quantity: 0 }]],
    ["quantité 11", [{ variantId: id(1), quantity: 11 }]],
    ["quantité décimale", [{ variantId: id(1), quantity: 1.5 }]],
    ["quantité en texte", [{ variantId: id(1), quantity: "2" }]],
    ["identifiant invalide", [{ variantId: "1; drop table", quantity: 1 }]],
    ["doublon", [{ variantId: id(1), quantity: 1 }, { variantId: id(1), quantity: 1 }]],
    ["trop de lignes", Array.from({ length: 21 }, (_, i) => ({ variantId: id(i + 1), quantity: 1 }))],
  ])("refuse (au lieu de corriger) : %s", (_, raw) => {
    expect(parseCheckoutLines(raw)).toBeNull();
  });
});

describe("cartCount", () => {
  it("compte les pièces, pas les lignes", () => {
    expect(cartCount([{ variantId: id(1), quantity: 2 }, { variantId: id(2), quantity: 3 }])).toBe(5);
    expect(cartCount([])).toBe(0);
  });
});
