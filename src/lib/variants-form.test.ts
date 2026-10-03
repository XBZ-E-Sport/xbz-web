import { describe, it, expect } from "vitest";

import { parseVariants } from "@/lib/variants-form";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Formulaire tel que l'envoie VariantsEditor. */
function form(rows: { id?: string; size: string; stock: string; orig?: string }[], deleted: string[] = []) {
  const fd = new FormData();
  for (const r of rows) {
    fd.append("variant_id", r.id ?? "");
    fd.append("variant_size", r.size);
    fd.append("variant_stock", r.stock);
    fd.append("variant_stock_orig", r.orig ?? "");
  }
  for (const d of deleted) fd.append("variant_delete", d);
  return fd;
}

describe("parseVariants (back-office)", () => {
  it("lit les tailles dans l'ordre, avec leur stock d'origine", () => {
    const { rows } = parseVariants(form([{ id: id(1), size: " M ", stock: "4", orig: "5" }, { size: "L", stock: "0" }]));
    expect(rows).toEqual([
      { id: id(1), size: "M", stock: 4, orig: 5, position: 1 },
      { id: null, size: "L", stock: 0, orig: null, position: 2 },
    ]);
  });

  it("aucune ligne : une taille unique à stock 0 (le produit n'est pas en vente)", () => {
    expect(parseVariants(form([])).rows).toEqual([{ id: null, size: "", stock: 0, orig: null, position: 1 }]);
  });

  it.each([
    ["stock négatif", [{ size: "M", stock: "-1" }], /Stock invalide/],
    ["stock décimal", [{ size: "M", stock: "1.5" }], /Stock invalide/],
    ["stock non numérique", [{ size: "M", stock: "abc" }], /Stock invalide/],
    ["stock en notation scientifique", [{ size: "M", stock: "1e2" }], /Stock invalide/],
    ["stock vidé", [{ size: "M", stock: "" }], /Stock manquant pour la taille « M »/],
    ["stock réduit à des espaces", [{ size: "M", stock: "  " }], /Stock manquant/],
    ["stock vidé d'une taille unique", [{ size: "", stock: "" }], /Stock manquant pour la taille « unique »/],
    ["taille en double", [{ size: "M", stock: "1" }, { size: "m", stock: "2" }], /en double/],
    ["taille vide parmi plusieurs", [{ size: "", stock: "1" }, { size: "M", stock: "2" }], /chacune doit avoir un nom/],
    ["taille trop longue", [{ size: "x".repeat(21), stock: "1" }], /trop longue/],
  ])("refuse : %s", (_, rows, message) => {
    expect(() => parseVariants(form(rows))).toThrow(message);
  });

  it("un stock saisi 0 reste valide (épuisé volontairement)", () => {
    expect(parseVariants(form([{ size: "M", stock: "0" }])).rows[0].stock).toBe(0);
  });

  it("ne garde que des identifiants valides à supprimer", () => {
    expect(parseVariants(form([{ size: "", stock: "1" }], [id(9), "'; drop"])).deleted).toEqual([id(9)]);
  });
});
