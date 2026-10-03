// Tailles et stock saisis au back-office (champs répétés de VariantsEditor),
// validés AVANT toute écriture. Module à part : testable sans base, et
// réutilisable par la création comme par la modification d'un produit.

import { AdminError } from "@/lib/admin-result";

export type VariantInput = { id: string | null; size: string; stock: number; orig: number | null; position: number };

const MAX_VARIANTS = 20;
const MAX_STOCK = 100_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tailles saisies (champs répétés de VariantsEditor), validées. Lève une
 * erreur lisible par le staff plutôt que d'enregistrer un stock douteux.
 */
export function parseVariants(fd: FormData): { rows: VariantInput[]; deleted: string[] } {
  const ids = fd.getAll("variant_id").map(String);
  const sizes = fd.getAll("variant_size").map((v) => String(v).trim());
  const stocks = fd.getAll("variant_stock").map(String);
  const origs = fd.getAll("variant_stock_orig").map(String);
  const deleted = fd
    .getAll("variant_delete")
    .map(String)
    .filter((id) => UUID.test(id));

  if (sizes.length > MAX_VARIANTS) throw new AdminError(`${MAX_VARIANTS} tailles au plus par produit.`);
  const rows = sizes.map((size, i): VariantInput => {
    if (size.length > 20) throw new AdminError(`Taille « ${size.slice(0, 20)}… » trop longue (20 caractères).`);
    // Champ vidé : refusé, pas lu comme 0 (`Number("")` vaut 0) — un stock
    // effacé par mégarde ne doit pas passer pour « épuisé » sans que personne
    // ne l'ait voulu.
    const raw = (stocks[i] ?? "").trim();
    const label = size || "unique";
    if (raw === "") throw new AdminError(`Stock manquant pour la taille « ${label} » : saisis un nombre (0 si épuisée).`);
    const stock = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(stock) || stock > MAX_STOCK) {
      throw new AdminError(`Stock invalide pour la taille « ${label} » : un nombre entier positif.`);
    }
    const id = UUID.test(ids[i] ?? "") ? ids[i] : null;
    const orig = origs[i] === "" || origs[i] === undefined ? null : Number(origs[i]);
    return { id, size, stock, orig: Number.isInteger(orig) ? orig : null, position: i + 1 };
  });

  if (rows.length === 0) rows.push({ id: null, size: "", stock: 0, orig: null, position: 1 });
  if (rows.length > 1 && rows.some((r) => r.size === "")) {
    throw new AdminError("Plusieurs tailles : chacune doit avoir un nom (une seule ligne vide = taille unique).");
  }
  const seen = new Set<string>();
  for (const r of rows) {
    const k = r.size.toUpperCase();
    if (seen.has(k)) throw new AdminError(`Taille « ${r.size} » en double.`);
    seen.add(k);
  }
  return { rows, deleted };
}
