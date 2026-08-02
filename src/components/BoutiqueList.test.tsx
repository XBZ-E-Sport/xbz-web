import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import BoutiqueList from "@/components/BoutiqueList";
import type { Product } from "@/lib/boutique";

const base = { description: "", image: null, available: false, url: null };
const products: Product[] = [
  { ...base, slug: "tshirt", name: "T-shirt XBZ", price: 25, category: "Textile", icon: "👕" },
  { ...base, slug: "mug", name: "Mug XBZ", price: 12, category: "Accessoire", icon: "☕" },
  { ...base, slug: "tapis", name: "Tapis souris", price: 20, category: "Gaming", icon: "🖱️" },
];

afterEach(() => cleanup());

describe("BoutiqueList", () => {
  it("affiche tous les produits par défaut", () => {
    render(<BoutiqueList products={products} />);
    expect(screen.getByText("T-shirt XBZ")).toBeTruthy();
    expect(screen.getByText("Mug XBZ")).toBeTruthy();
    expect(screen.getByText("Tapis souris")).toBeTruthy();
  });

  it("ne propose que les catégories réellement présentes", () => {
    const onlyTextile = [products[0]];
    render(<BoutiqueList products={onlyTextile} />);
    expect(screen.getByRole("button", { name: "Textile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Gaming" })).toBeNull();
  });

  it("filtre par catégorie via les chips", () => {
    render(<BoutiqueList products={products} />);
    fireEvent.click(screen.getByRole("button", { name: "Textile" }));
    expect(screen.getByText("T-shirt XBZ")).toBeTruthy();
    expect(screen.queryByText("Mug XBZ")).toBeNull();
    expect(screen.queryByText("Tapis souris")).toBeNull();
  });

  it("trie par prix croissant", () => {
    render(<BoutiqueList products={products} />);
    fireEvent.change(screen.getByLabelText("Trier"), { target: { value: "prix-asc" } });
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Mug XBZ", "Tapis souris", "T-shirt XBZ"]); // 12 < 20 < 25
  });
});
