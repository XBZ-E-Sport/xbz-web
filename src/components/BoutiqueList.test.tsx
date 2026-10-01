import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";

import BoutiqueList from "@/components/BoutiqueList";
import type { Product } from "@/lib/boutique";
import { renderIntl, messages } from "../../test/intl";

const base = { description: "", image: null, available: false, variants: [] };
const products: Product[] = [
  { ...base, slug: "tshirt", name: "T-shirt XBZ", price: 25, category: "Textile", icon: "👕" },
  { ...base, slug: "mug", name: "Mug XBZ", price: 12, category: "Accessoire", icon: "☕" },
  { ...base, slug: "tapis", name: "Tapis souris", price: 20, category: "Gaming", icon: "🖱️" },
];

const fr = messages("fr");
const en = messages("en");

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

describe("BoutiqueList", () => {
  it("affiche tous les produits par défaut", () => {
    renderIntl(<BoutiqueList products={products} />);
    expect(screen.getByText("T-shirt XBZ")).toBeTruthy();
    expect(screen.getByText("Mug XBZ")).toBeTruthy();
    expect(screen.getByText("Tapis souris")).toBeTruthy();
  });

  it("ne propose que les catégories réellement présentes", () => {
    const onlyTextile = [products[0]];
    renderIntl(<BoutiqueList products={onlyTextile} />);
    expect(screen.getByRole("button", { name: fr.productCategories.Textile })).toBeTruthy();
    expect(screen.queryByRole("button", { name: fr.productCategories.Gaming })).toBeNull();
  });

  it("filtre par catégorie via les chips", () => {
    renderIntl(<BoutiqueList products={products} />);
    fireEvent.click(screen.getByRole("button", { name: fr.productCategories.Textile }));
    expect(screen.getByText("T-shirt XBZ")).toBeTruthy();
    expect(screen.queryByText("Mug XBZ")).toBeNull();
    expect(screen.queryByText("Tapis souris")).toBeNull();
  });

  it("trie par prix croissant", () => {
    renderIntl(<BoutiqueList products={products} />);
    fireEvent.change(screen.getByLabelText(fr.boutique.sort), { target: { value: "prix-asc" } });
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Mug XBZ", "Tapis souris", "T-shirt XBZ"]); // 12 < 20 < 25
  });

  it("s'affiche en anglais quand la langue est en", () => {
    renderIntl(<BoutiqueList products={products} />, { locale: "en" });
    // Libellé traduit ET catégorie traduite : la carte entière suit la langue.
    expect(screen.getByLabelText(en.boutique.sort)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.productCategories.Textile })).toBeTruthy();
    expect(screen.getAllByText(en.boutique.comingSoon).length).toBe(products.length);
  });

  it("formate les prix selon la langue", () => {
    renderIntl(<BoutiqueList products={[products[1]] } />);
    expect(screen.getByText("12,00 €")).toBeTruthy();
    cleanup();
    renderIntl(<BoutiqueList products={[products[1]] } />, { locale: "en" });
    expect(screen.getByText("€12.00")).toBeTruthy();
  });

  it("retombe sur l'emoji quand l'image ne charge pas", () => {
    // Cas vécu : un visuel stocké corrompu (69 % de son contenu remplacé par
    // « � »). L'optimiseur d'images répondait 400 et la carte affichait un
    // cadre vide, sans que rien ne le signale.
    const avecImage = [{ ...products[0], image: "https://exemple.test/casse.webp", icon: "🧢" }];
    renderIntl(<BoutiqueList products={avecImage} />);

    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    fireEvent.error(img);

    expect(screen.getByText("🧢")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("charge sans attendre les images de la première rangée, en différé ensuite", () => {
    // Les cartes sans photo affichent un emoji, présent dès le premier octet de
    // HTML. Une image en `lazy` arrivait donc visiblement APRÈS ses voisines.
    // `priority` la met en chargement immédiat et la précharge — c'est ce qui
    // aligne l'apparition. Au-delà de la première rangée, `lazy` reste correct.
    const avecImages = Array.from({ length: 4 }, (_, i) => ({
      ...products[0],
      slug: `p${i}`,
      name: `Produit ${i}`,
      image: `https://exemple.test/p${i}.webp`,
    }));
    renderIntl(<BoutiqueList products={avecImages} />);

    const imgs = [...document.querySelectorAll("img")];
    expect(imgs).toHaveLength(4);
    // `priority` retire l'attribut `loading` (donc chargement immédiat, la
    // valeur par défaut du navigateur) ; sans lui, next/image pose `lazy`.
    expect(imgs.slice(0, 3).map((i) => i.getAttribute("loading"))).toEqual([null, null, null]);
    expect(imgs[3].getAttribute("loading")).toBe("lazy");
  });

  describe("achat : tailles et panier", () => {
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    const maillot: Product = {
      ...products[0],
      available: true,
      variants: [
        { id: id(1), size: "S", stock: 5 },
        { id: id(2), size: "M", stock: 2 },
        { id: id(3), size: "L", stock: 0 },
      ],
    };
    const mug: Product = { ...products[1], available: true, variants: [{ id: id(4), size: "", stock: 3 }] };
    const cart = () => JSON.parse(localStorage.getItem("xbz-cart-v1") ?? "[]");

    it("boutique fermée (Stripe absent) : « bientôt disponible », rien à ajouter", () => {
      renderIntl(<BoutiqueList products={[maillot]} />);
      expect(screen.getByText(fr.boutique.comingSoon)).toBeTruthy();
      expect(screen.queryByRole("button", { name: fr.boutique.addToCart })).toBeNull();
    });

    it("propose les tailles ; une taille épuisée reste visible mais n'est pas choisissable", () => {
      renderIntl(<BoutiqueList products={[maillot]} open />);
      const group = screen.getByRole("group", { name: fr.boutique.size });
      expect(group).toBeTruthy();
      // Nom accessible : « L — épuisée », pas seulement un « L » barré à l'écran.
      expect((screen.getByRole("radio", { name: "S" }) as HTMLInputElement).disabled).toBe(false);
      expect((screen.getByRole("radio", { name: "L — épuisée" }) as HTMLInputElement).disabled).toBe(true);
    });

    it("demande une taille avant d'ajouter, puis ajoute la taille choisie", () => {
      renderIntl(<BoutiqueList products={[maillot]} open />);
      fireEvent.click(screen.getByRole("button", { name: fr.boutique.addToCart }));
      expect(screen.getByText(fr.boutique.chooseSize)).toBeTruthy();
      expect(cart()).toEqual([]);

      fireEvent.click(screen.getByRole("radio", { name: "M" }));
      fireEvent.click(screen.getByRole("button", { name: fr.boutique.addToCart }));
      expect(cart()).toEqual([{ variantId: id(2), quantity: 1 }]);
      expect(screen.getByRole("link", { name: fr.boutique.viewCart }).getAttribute("href")).toBe("/fr/boutique/panier");
    });

    it("n'ajoute jamais plus que le stock affiché", () => {
      renderIntl(<BoutiqueList products={[maillot]} open />);
      fireEvent.click(screen.getByRole("radio", { name: "M" })); // stock 2
      const add = screen.getByRole("button", { name: fr.boutique.addToCart });
      fireEvent.click(add);
      fireEvent.click(add);
      fireEvent.click(add);
      expect(cart()).toEqual([{ variantId: id(2), quantity: 2 }]);
      expect(screen.getByText(fr.boutique.maxInCart)).toBeTruthy();
    });

    it("prévient quand il reste peu de pièces", () => {
      renderIntl(<BoutiqueList products={[maillot]} open />);
      fireEvent.click(screen.getByRole("radio", { name: "M" }));
      expect(screen.getByText("Plus que 2 pièces !")).toBeTruthy();
    });

    it("taille unique : pas de choix à faire, ajout direct", () => {
      renderIntl(<BoutiqueList products={[mug]} open />);
      expect(screen.queryByRole("group", { name: fr.boutique.size })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: fr.boutique.addToCart }));
      expect(cart()).toEqual([{ variantId: id(4), quantity: 1 }]);
    });

    it("tout est épuisé : « rupture de stock », pas de bouton", () => {
      const vide: Product = { ...mug, variants: [{ id: id(4), size: "", stock: 0 }] };
      renderIntl(<BoutiqueList products={[vide]} open />);
      expect(screen.getByText(fr.boutique.outOfStock)).toBeTruthy();
      expect(screen.queryByRole("button", { name: fr.boutique.addToCart })).toBeNull();
    });

    it("le prix n'est jamais mis dans le panier (seulement taille et quantité)", () => {
      renderIntl(<BoutiqueList products={[mug]} open />);
      fireEvent.click(screen.getByRole("button", { name: fr.boutique.addToCart }));
      expect(Object.keys(cart()[0]).sort()).toEqual(["quantity", "variantId"]);
    });
  });
});
