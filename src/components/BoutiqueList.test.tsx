import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";

import BoutiqueList from "@/components/BoutiqueList";
import type { Product } from "@/lib/boutique";
import { renderIntl, messages } from "../../test/intl";

const base = { description: "", image: null, available: false, url: null };
const products: Product[] = [
  { ...base, slug: "tshirt", name: "T-shirt XBZ", price: 25, category: "Textile", icon: "👕" },
  { ...base, slug: "mug", name: "Mug XBZ", price: 12, category: "Accessoire", icon: "☕" },
  { ...base, slug: "tapis", name: "Tapis souris", price: 20, category: "Gaming", icon: "🖱️" },
];

const fr = messages("fr");
const en = messages("en");

afterEach(() => cleanup());

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
});
