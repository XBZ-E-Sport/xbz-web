import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";

import BuyBox from "@/components/BuyBox";
import type { Product } from "@/lib/boutique";
import { clearCart, getCart } from "@/lib/cart-store";
import { renderIntl, messages } from "../../test/intl";

const fr = messages("fr");
const en = messages("en");
const VARIANT = "00000000-0000-4000-8000-000000000001";

const product = (over: Partial<Product> = {}): Product => ({
  slug: "maillot-officiel",
  name: "Maillot officiel XBZ",
  description: "",
  price: 49.99,
  category: "Textile",
  icon: "👕",
  image: null,
  images: [],
  sizeGuide: null,
  available: true,
  personalizable: true,
  personalizationPrice: 5,
  variants: [{ id: VARIANT, size: "M", stock: 4 }],
  ...over,
});

const perso = () => screen.getByLabelText(new RegExp(fr.boutique.personalize.replace(/[()]/g, "\\$&")));
const name = () => screen.getByLabelText(fr.boutique.printNameLabel) as HTMLInputElement;
const number = () => screen.getByLabelText(fr.boutique.printNumberLabel) as HTMLInputElement;
const ack = () => screen.getByLabelText(/J’ai compris qu’un article personnalisé/);
const add = () => fireEvent.click(screen.getByRole("button", { name: fr.boutique.addToCart }));

beforeEach(() => {
  clearCart();
  localStorage.clear();
});
afterEach(cleanup);

describe("BuyBox : personnalisation", () => {
  it("pas proposée sur les cartes de la boutique (propriété absente)", () => {
    renderIntl(<BuyBox product={product()} open />);
    expect(screen.queryByText(fr.boutique.personalize)).toBeNull();
  });

  it("pas proposée si le produit ne l'autorise pas (interrupteur éteint), même sur la page produit", () => {
    renderIntl(<BuyBox product={product({ personalizable: false })} open personalization />);
    expect(screen.queryByText(fr.boutique.personalize)).toBeNull();
    add();
    expect(getCart()).toEqual([{ variantId: VARIANT, quantity: 1 }]);
  });

  it("proposée sur la page produit avec son supplément ; les champs n'apparaissent qu'une fois cochée", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    expect(screen.getByText(/\+ 5,00 € par pièce personnalisée/)).toBeTruthy();
    expect(screen.queryByLabelText(fr.boutique.printNameLabel)).toBeNull();
    fireEvent.click(perso());
    expect(name()).toBeTruthy();
    expect(number()).toBeTruthy();
  });

  it("supplément nul : aucun prix affiché", () => {
    renderIntl(<BuyBox product={product({ personalizationPrice: 0 })} open personalization />);
    expect(screen.queryByText(/par pièce personnalisée/)).toBeNull();
  });

  it("décochée : article ordinaire, sans texte (la personnalisation est facultative)", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    add();
    expect(getCart()).toEqual([{ variantId: VARIANT, quantity: 1 }]);
  });

  it("nom, numéro et accord : la ligne porte le texte, mis en forme, avec un aperçu", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    fireEvent.click(perso());
    fireEvent.change(name(), { target: { value: "martin" } });
    fireEvent.change(number(), { target: { value: "7" } });
    expect(screen.getByText("Aperçu : MARTIN · n° 7")).toBeTruthy();
    fireEvent.click(ack());
    add();
    expect(getCart()).toEqual([{ variantId: VARIANT, quantity: 1, print: { name: "MARTIN", number: "7" } }]);
    expect(screen.getByText(fr.boutique.added)).toBeTruthy();
  });

  it("nom seul ou numéro seul : accepté", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    fireEvent.click(perso());
    fireEvent.change(number(), { target: { value: "0" } });
    fireEvent.click(ack());
    add();
    expect(getCart()).toEqual([{ variantId: VARIANT, quantity: 1, print: { number: "0" } }]);
  });

  it("sans l'accord sur l'exclusion de la rétractation : refusé, rien au panier", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    fireEvent.click(perso());
    fireEvent.change(name(), { target: { value: "MARTIN" } });
    add();
    expect(screen.getByText(fr.boutique.errPrintAck)).toBeTruthy();
    expect(getCart()).toEqual([]);
  });

  it("rien à imprimer : refusé", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    fireEvent.click(perso());
    fireEvent.click(ack());
    add();
    expect(screen.getByText(fr.boutique.errPrintEmpty)).toBeTruthy();
    expect(getCart()).toEqual([]);
  });

  it("nom invalide : message sur le NOM ; le numéro ne peut contenir que des chiffres", () => {
    renderIntl(<BuyBox product={product()} open personalization />);
    fireEvent.click(perso());
    fireEvent.change(name(), { target: { value: "M4RTIN" } });
    fireEvent.change(number(), { target: { value: "1a0b" } });
    expect(number().value).toBe("10");
    fireEvent.click(ack());
    add();
    expect(screen.getByText(fr.boutique.errPrintName)).toBeTruthy();
    expect(getCart()).toEqual([]);
  });

  it("une taille, deux textes : deux lignes ; le stock de la taille est partagé", () => {
    renderIntl(<BuyBox product={product({ variants: [{ id: VARIANT, size: "M", stock: 2 }] })} open personalization />);
    add(); // ordinaire
    fireEvent.click(perso());
    fireEvent.change(name(), { target: { value: "MARTIN" } });
    fireEvent.click(ack());
    add(); // personnalisé : 2e pièce de la taille
    expect(getCart()).toHaveLength(2);
    add(); // 3e pièce : stock atteint
    expect(screen.getByText(fr.boutique.maxInCart)).toBeTruthy();
    expect(getCart().reduce((n, l) => n + l.quantity, 0)).toBe(2);
  });

  it("anglais : libellés traduits", () => {
    renderIntl(<BuyBox product={product()} open personalization />, { locale: "en" });
    fireEvent.click(screen.getByLabelText(/Personalise \(name and number\)/));
    expect(screen.getByLabelText(en.boutique.printNameLabel)).toBeTruthy();
    expect(screen.getByLabelText(/I understand that a personalised item/)).toBeTruthy();
  });
});
