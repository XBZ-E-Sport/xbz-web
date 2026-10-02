"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
// Type seulement : lib/boutique tire le client Supabase serveur.
import type { Product } from "@/lib/boutique";
import { CART_MAX_QUANTITY } from "@/lib/cart";
import { addToCart, useCart } from "@/lib/cart-store";

/** Seuil sous lequel on prévient qu'il reste peu de pièces. */
const LOW_STOCK = 3;

type AddStatus = "added" | "chooseSize" | "max" | "full";

/**
 * Achat d'un produit : choix de la taille (si plusieurs), puis ajout au panier.
 * Les tailles épuisées restent visibles, barrées et non cliquables : le client
 * voit ce qui existe et ce qui reviendra.
 */
export default function BuyBox({ product, open }: { product: Product; open: boolean }) {
  const t = useTranslations("boutique");
  const uid = useId();
  const cart = useCart();
  const single = product.variants.length === 1 && product.variants[0].size === "";
  const inStock = product.variants.filter((v) => v.stock > 0);
  // Une seule taille disponible : déjà choisie, inutile de faire cliquer.
  const [chosen, setChosen] = useState<string | null>(
    single || inStock.length === 1 ? (inStock[0]?.id ?? null) : null,
  );
  const [status, setStatus] = useState<AddStatus | null>(null);

  if (!open || !product.available) {
    return (
      <span className="block rounded-lg border border-white/15 px-4 py-2 text-center text-sm font-semibold text-neutral-400">
        {t("comingSoon")}
      </span>
    );
  }
  if (inStock.length === 0) {
    return (
      <span className="block rounded-lg border border-white/15 px-4 py-2 text-center text-sm font-semibold text-neutral-400">
        {t("outOfStock")}
      </span>
    );
  }

  const variant = product.variants.find((v) => v.id === chosen) ?? null;
  const inCart = variant ? (cart.find((l) => l.variantId === variant.id)?.quantity ?? 0) : 0;

  function add() {
    if (!variant) {
      setStatus("chooseSize");
      return;
    }
    const max = Math.min(CART_MAX_QUANTITY, variant.stock);
    if (inCart >= max) {
      setStatus("max");
      return;
    }
    setStatus(addToCart(variant.id, 1, max) > 0 ? "added" : "full");
  }

  return (
    <div className="flex flex-col gap-3">
      {!single && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {t("size")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const out = v.stock <= 0;
              const id = `${uid}-${v.id}`;
              return (
                <div key={v.id}>
                  <input
                    id={id}
                    type="radio"
                    name={`${uid}-size`}
                    value={v.id}
                    checked={chosen === v.id}
                    disabled={out}
                    onChange={() => {
                      setChosen(v.id);
                      setStatus(null);
                    }}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    className="inline-flex min-w-10 cursor-pointer items-center justify-center rounded-md border border-white/20 px-2.5 py-1.5 text-sm font-bold text-neutral-200 transition peer-checked:border-xbz-cyan peer-checked:bg-xbz-cyan peer-checked:text-[#231a17] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-xbz-cyan peer-disabled:cursor-not-allowed peer-disabled:border-white/10 peer-disabled:text-neutral-500 peer-disabled:line-through hover:border-white/50"
                  >
                    {/* Épuisée : nom accessible « L — épuisée », pas seulement barré. */}
                    <span aria-hidden={out || undefined}>{v.size}</span>
                    {out && <span className="sr-only">{t("sizeSoldOut", { size: v.size })}</span>}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {variant && variant.stock <= LOW_STOCK && (
        <p className="text-xs font-semibold text-xbz-cyan">{t("lowStock", { count: variant.stock })}</p>
      )}

      <button
        type="button"
        onClick={add}
        className="block w-full rounded-lg bg-xbz-blue px-4 py-2 text-center text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer"
      >
        {t("addToCart")}
      </button>

      {/* Retour de l'ajout, annoncé aux lecteurs d'écran. */}
      <p aria-live="polite" className="min-h-5 text-center text-sm">
        {status === "added" && (
          <span className="text-neutral-300">
            {t("added")}{" "}
            <Link href="/boutique/panier" className="font-semibold text-xbz-cyan underline-offset-2 hover:underline">
              {t("viewCart")}
            </Link>
          </span>
        )}
        {status === "chooseSize" && <span className="text-xbz-red-light">{t("chooseSize")}</span>}
        {status === "max" && <span className="text-neutral-300">{t("maxInCart")}</span>}
        {status === "full" && <span className="text-xbz-red-light">{t("cartFull")}</span>}
      </p>
    </div>
  );
}
