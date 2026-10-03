// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), promise: vi.fn() }) }));

import AdminForm from "@/components/AdminForm";
import { parseVariants } from "@/lib/variants-form";
import type { AdminAction } from "@/lib/admin-result";
import VariantsEditor, { type VariantRow } from "./VariantsEditor";

afterEach(() => cleanup());

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Ce que l'éditeur enverrait au serveur, relu comme le fait l'action. */
function sent(container: HTMLElement) {
  const form = container.querySelector("form")!;
  return parseVariants(new FormData(form));
}
const sizes = (container: HTMLElement) => sent(container).rows.map((r) => `${r.size || "unique"}:${r.stock}`);

function setup(variants: VariantRow[]) {
  const { container } = render(
    <AdminForm action={vi.fn<AdminAction>(async () => undefined)}>
      <VariantsEditor uid="p" variants={variants} />
    </AdminForm>,
  );
  return container;
}
const clothing = () => fireEvent.click(screen.getByRole("button", { name: /Tailles vêtements/ }));

describe("VariantsEditor — « + Tailles vêtements »", () => {
  it("produit antérieur à la boutique (taille unique en base, stock 0) : elle laisse la place aux tailles", () => {
    // La migration a créé une ligne « taille unique » AVEC identifiant pour
    // chaque produit existant : elle restait, et l'enregistrement échouait sur
    // « Plusieurs tailles : chacune doit avoir un nom ».
    const c = setup([{ id: id(1), size: "", stock: 0 }]);
    clothing();
    const { rows, deleted } = sent(c);
    expect(rows.map((r) => r.size)).toEqual(["S", "M", "L", "XL", "XXL"]);
    expect(deleted).toEqual([id(1)]);
  });

  it("taille unique encore en stock : refus expliqué, rien n'est supprimé ni perdu", () => {
    const c = setup([{ id: id(1), size: "", stock: 7 }]);
    clothing();
    expect(screen.getByRole("status").textContent).toMatch(/7 pièces/);
    const { rows, deleted } = sent(c);
    expect(rows.map((r) => `${r.size || "unique"}:${r.stock}`)).toEqual(["unique:7"]);
    expect(deleted).toEqual([]);
  });

  it("taille unique en stock mais ramenée à 0 par le staff : acceptée", () => {
    const c = setup([{ id: id(1), size: "", stock: 7 }]);
    fireEvent.change(c.querySelector('input[name="variant_stock"]')!, { target: { value: "0" } });
    clothing();
    expect(sent(c).rows).toHaveLength(5);
    expect(sent(c).deleted).toEqual([id(1)]);
  });

  it("conserve les tailles existantes et leur stock, n'ajoute que les manquantes", () => {
    const c = setup([
      { id: id(1), size: "S", stock: 6 },
      { id: id(2), size: "M", stock: 2 },
    ]);
    clothing();
    expect(sizes(c)).toEqual(["S:6", "M:2", "L:0", "XL:0", "XXL:0"]);
    expect(sent(c).deleted).toEqual([]);
  });

  it("produit neuf (ligne vide sans identifiant) : remplacée, rien à supprimer en base", () => {
    const c = setup([]);
    clothing();
    expect(sizes(c)).toEqual(["S:0", "M:0", "L:0", "XL:0", "XXL:0"]);
    expect(sent(c).deleted).toEqual([]);
  });

  it("deux clics : pas de doublon de taille", () => {
    const c = setup([]);
    clothing();
    clothing();
    expect(sizes(c)).toEqual(["S:0", "M:0", "L:0", "XL:0", "XXL:0"]);
  });
});

describe("VariantsEditor — formulaire d'ajout", () => {
  it("après un ajout réussi, le formulaire suivant ne reprend pas les tailles ni les stocks du précédent", async () => {
    const action = vi.fn<AdminAction>(async () => undefined);
    const { container } = render(
      <AdminForm action={action}>
        <VariantsEditor uid="product-new" variants={[]} />
      </AdminForm>,
    );
    clothing();
    const stock = () => container.querySelector<HTMLInputElement>('input[name="variant_stock"]')!;
    fireEvent.change(stock(), { target: { value: "12" } });
    expect(sizes(container)[0]).toBe("S:12");

    const { act } = await import("@testing-library/react");
    await act(async () => {
      container.querySelector("form")!.requestSubmit();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(action).toHaveBeenCalledTimes(1);
    // Remis à neuf : une seule ligne « taille unique », stock 0.
    expect(sizes(container)).toEqual(["unique:0"]);
  });
});

describe("VariantsEditor — ce que montre le formulaire de modification", () => {
  it("reflète le stock de la base, taille par taille (jamais 0 par défaut)", () => {
    const c = setup([
      { id: id(1), size: "M", stock: 2 },
      { id: id(2), size: "S", stock: 6 },
    ]);
    expect(sizes(c)).toEqual(["M:2", "S:6"]);
    // et garde l'origine pour détecter une vente survenue pendant la saisie
    expect(sent(c).rows.map((r) => r.orig)).toEqual([2, 6]);
  });
});
