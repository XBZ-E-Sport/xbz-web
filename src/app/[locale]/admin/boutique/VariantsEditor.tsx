"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";

export type VariantRow = { id: string; size: string; stock: number };

type Row = { key: string; id: string | null; size: string; stock: string; orig: number | null };

const CLOTHING = ["S", "M", "L", "XL", "XXL"];
let counter = 0;
const newKey = () => `new-${(counter += 1)}`;

/**
 * Tailles et stock d'un produit. Chaque ligne part dans le formulaire sous
 * des champs répétés (`variant_id`, `variant_size`, `variant_stock`…), relus
 * par l'action serveur.
 *
 * Le stock saisi est le stock DISPONIBLE à la vente, hors pièces réservées par
 * un paiement en cours. `variant_stock_orig` garde la valeur affichée au
 * chargement : si une vente l'a changée entre-temps, l'enregistrement le
 * détecte au lieu d'écraser la vente.
 */
export default function VariantsEditor({ uid, variants }: { uid: string; variants: VariantRow[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    variants.length
      ? variants.map((v) => ({ key: v.id, id: v.id, size: v.size, stock: String(v.stock), orig: v.stock }))
      : [{ key: newKey(), id: null, size: "", stock: "0", orig: null }],
  );
  const [removed, setRemoved] = useState<string[]>([]);
  // Explication affichée quand un bouton ne fait pas ce qu'il propose.
  const [notice, setNotice] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (row: Row) => {
    setNotice(null);
    if (row.id) setRemoved((ids) => [...ids, row.id!]);
    setRows((rs) => rs.filter((r) => r.key !== row.key));
  };
  const addSizes = (sizes: string[]) => {
    // La « taille unique » (nom vide) ne cohabite pas avec de vraies tailles :
    // le serveur refuserait « Plusieurs tailles : chacune doit avoir un nom ».
    //  - sans stock, elle laisse la place aux vraies tailles — y compris celle,
    //    déjà en base, que la migration a créée pour chaque produit antérieur
    //    à la boutique (elle porte un identifiant : il faut aussi la supprimer) ;
    //  - avec du stock, on ne la supprime pas en silence : on explique.
    const blank = rows.filter((r) => r.size.trim() === "");
    const withStock = blank.find((r) => Number(r.stock) > 0);
    if (withStock) {
      setNotice(
        `La taille unique contient encore ${Number(withStock.stock)} pièce${Number(withStock.stock) > 1 ? "s" : ""} : ` +
          "donne-lui un nom (ex. M), ou mets son stock à 0, avant d’ajouter des tailles.",
      );
      return;
    }
    setNotice(null);
    const dropped = blank.filter((r) => r.id).map((r) => r.id!);
    if (dropped.length) setRemoved((ids) => [...ids, ...dropped]);
    const kept = rows.filter((r) => r.size.trim() !== "");
    const have = new Set(kept.map((r) => r.size.trim().toUpperCase()));
    setRows([
      ...kept,
      ...sizes.filter((s) => !have.has(s)).map((s) => ({ key: newKey(), id: null, size: s, stock: "0", orig: null })),
    ]);
  };

  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Tailles &amp; stock disponible
      </legend>
      <p className="mb-2 text-xs text-neutral-400">
        Une ligne par taille. Pour un article sans taille (mug, tapis…), une seule ligne au nom vide. Le stock est
        décompté automatiquement à chaque vente ; une taille à 0 s’affiche « épuisée ».
      </p>

      {removed.map((id) => (
        <input key={id} type="hidden" name="variant_delete" value={id} />
      ))}

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
            <input type="hidden" name="variant_id" value={r.id ?? ""} />
            <input type="hidden" name="variant_stock_orig" value={r.orig ?? ""} />
            <label htmlFor={`${uid}-size-${i}`} className="sr-only">
              Taille {i + 1}
            </label>
            <input
              id={`${uid}-size-${i}`}
              name="variant_size"
              value={r.size}
              onChange={(e) => update(r.key, { size: e.target.value })}
              placeholder={rows.length === 1 ? "Taille unique (vide)" : "ex. M"}
              maxLength={20}
              className={inputCls}
            />
            <label htmlFor={`${uid}-stock-${i}`} className="sr-only">
              Stock taille {r.size || "unique"}
            </label>
            <input
              id={`${uid}-stock-${i}`}
              name="variant_stock"
              type="number"
              min={0}
              step={1}
              value={r.stock}
              onChange={(e) => update(r.key, { stock: e.target.value })}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => remove(r)}
              disabled={rows.length === 1}
              aria-label={`Retirer la taille ${r.size || "unique"}`}
              className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30 hover:cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setRows((rs) => [...rs, { key: newKey(), id: null, size: "", stock: "0", orig: null }]);
          }}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:cursor-pointer"
        >
          + Ajouter une taille
        </button>
        <button
          type="button"
          onClick={() => addSizes(CLOTHING)}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:cursor-pointer"
        >
          + Tailles vêtements ({CLOTHING.join(", ")})
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-neutral-200">
          {notice}
        </p>
      )}
    </fieldset>
  );
}
