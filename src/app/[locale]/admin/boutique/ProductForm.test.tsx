// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), promise: vi.fn() }) }));
// Les actions sont des server actions (base, stockage) : inutiles ici.
vi.mock("./actions", () => ({
  addProductPhoto: vi.fn(),
  removeProductPhoto: vi.fn(),
  setMainProductPhoto: vi.fn(),
}));

import ProductForm, { type ProductRow } from "./ProductForm";
import ProductPhotos from "./ProductPhotos";

afterEach(() => cleanup());

const product: ProductRow = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "maillot",
  name: "Maillot",
  name_en: null,
  description: "",
  description_en: null,
  price: 49.99,
  category: "Textile",
  icon: "👕",
  image: "https://cdn.test/main.png",
  available: true,
  position: 0,
  active: true,
  variants: [{ id: "22222222-2222-4222-8222-222222222222", size: "M", stock: 2 }],
  images: ["https://cdn.test/a.png", "https://cdn.test/b.png"],
  size_guide: null,
  size_guide_en: null,
};

describe("ProductForm — exemples", () => {
  it("chaque exemple de saisie est annoncé par « ex. » (ce n'est pas une vraie valeur)", () => {
    const { container } = render(<ProductForm action={vi.fn()} submitLabel="Ajouter" sizeGuide />);
    const placeholders = [...container.querySelectorAll<HTMLElement>("input[placeholder], textarea[placeholder]")]
      .map((el) => el.getAttribute("placeholder")!)
      // Consignes, pas des exemples de valeur.
      .filter((p) => !p.startsWith("…") && p !== "Taille unique (vide)");
    expect(placeholders.length).toBeGreaterThanOrEqual(7);
    expect(placeholders.filter((p) => !p.startsWith("ex."))).toEqual([]);
  });
});

describe("ProductForm — photo principale", () => {
  it("la modification transmet la photo principale affichée (garde-fou contre un formulaire resté ouvert)", () => {
    const { container } = render(<ProductForm action={vi.fn()} product={product} submitLabel="Enregistrer" />);
    expect(container.querySelector<HTMLInputElement>('input[name="image_orig"]')!.value).toBe(product.image);
  });

  it("l'ajout n'en transmet pas (rien à protéger)", () => {
    const { container } = render(<ProductForm action={vi.fn()} submitLabel="Ajouter" />);
    expect(container.querySelector('input[name="image_orig"]')).toBeNull();
  });
});

describe("ProductPhotos", () => {
  it("montre la principale puis les supplémentaires, avec « En principale » et « Retirer » sur chacune", () => {
    render(<ProductPhotos product={product} />);
    const section = screen.getByRole("region", { name: "Photos" });
    const photos = within(section).getAllByRole("img");
    expect(photos.map((i) => i.getAttribute("alt"))).toEqual([
      "Photo principale",
      "Photo supplémentaire 1",
      "Photo supplémentaire 2",
    ]);
    expect(within(section).getAllByRole("button", { name: "En principale" })).toHaveLength(2);
    expect(within(section).getAllByRole("button", { name: "Retirer" })).toHaveLength(2);
    expect(within(section).getByText("Principale")).toBeTruthy();
  });

  it("propose « Ajouter une photo supplémentaire » avec le compteur", () => {
    render(<ProductPhotos product={product} />);
    expect(screen.getByLabelText(/Ajouter une photo supplémentaire \(2\/8\)/)).toBeTruthy();
  });

  it("sans photo principale : le dit, au lieu d'un cadre vide", () => {
    render(<ProductPhotos product={{ ...product, image: null, images: [] }} />);
    expect(screen.getByText(/Pas de photo/)).toBeTruthy();
  });

  it("au maximum de photos : plus de formulaire d'ajout, avec explication", () => {
    const images = Array.from({ length: 8 }, (_, i) => `https://cdn.test/${i}.png`);
    render(<ProductPhotos product={{ ...product, images }} />);
    expect(screen.queryByLabelText(/Ajouter une photo/)).toBeNull();
    expect(screen.getByText(/Maximum atteint \(8\/8\)/)).toBeTruthy();
  });
});

describe("page Boutique du back-office", () => {
  it("les photos passent AVANT le formulaire du produit (elles étaient sous « Enregistrer », inaperçues)", () => {
    const src = readFileSync("src/app/[locale]/admin/boutique/page.tsx", "utf8");
    const photos = src.indexOf("<ProductPhotos product={p}");
    const form = src.indexOf("<ProductForm action={updateProduct}");
    expect(photos).toBeGreaterThan(-1);
    expect(photos).toBeLessThan(form);
  });
});
