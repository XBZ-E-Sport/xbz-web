"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
// Type seulement : lib/boutique tire le client Supabase serveur.
import type { Product } from "@/lib/boutique";
import { CART_MAX_QUANTITY } from "@/lib/cart";
import { addToCart, useCart } from "@/lib/cart-store";
import { formatEuros } from "@/lib/money";
import { PRINT_NAME_MAX, normalizePrintName, normalizePrintNumber, parsePrint, printText } from "@/lib/personalization";

/** Seuil sous lequel on prévient qu'il reste peu de pièces. */
const LOW_STOCK = 3;

type AddStatus =
  | "added"
  | "chooseSize"
  | "max"
  | "full"
  | "printEmpty"
  | "printName"
  | "printNumber"
  | "printAck";

const inputCls =
  "w-full rounded-md border border-white/20 bg-[#111] px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus-visible:border-xbz-cyan";

/**
 * Achat d'un produit : choix de la taille (si plusieurs), puis ajout au panier.
 * Les tailles épuisées restent visibles, barrées et non cliquables : le client
 * voit ce qui existe et ce qui reviendra.
 *
 * `personalization` (page produit seulement) propose, si le produit l'autorise
 * (interrupteur du back-office), le nom et le numéro à imprimer. La personnalisation
 * est facultative : sans elle, c'est l'article ordinaire au prix ordinaire.
 */
export default function BuyBox({
  product,
  open,
  personalization = false,
}: {
  product: Product;
  open: boolean;
  personalization?: boolean;
}) {
  const t = useTranslations("boutique");
  const locale = useLocale();
  const uid = useId();
  const cart = useCart();
  const single = product.variants.length === 1 && product.variants[0].size === "";
  const inStock = product.variants.filter((v) => v.stock > 0);
  // Une seule taille disponible : déjà choisie, inutile de faire cliquer.
  const [chosen, setChosen] = useState<string | null>(
    single || inStock.length === 1 ? (inStock[0]?.id ?? null) : null,
  );
  const [status, setStatus] = useState<AddStatus | null>(null);
  const canPersonalize = personalization && product.personalizable;
  const [personalize, setPersonalize] = useState(false);
  const [printName, setPrintName] = useState("");
  const [printNumber, setPrintNumber] = useState("");
  const [ack, setAck] = useState(false);

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
  // Pièces de cette taille déjà au panier, avec ou sans personnalisation.
  const inCart = variant ? cart.reduce((n, l) => (l.variantId === variant.id ? n + l.quantity : n), 0) : 0;

  function add() {
    if (!variant) {
      setStatus("chooseSize");
      return;
    }
    let print;
    if (canPersonalize && personalize) {
      print = parsePrint({ name: printName, number: printNumber });
      if (print === undefined) return setStatus("printEmpty");
      if (print === null) {
        // Dire QUEL champ est refusé.
        const nameBad = printName.trim() !== "" && normalizePrintName(printName) === null;
        const numberBad = printNumber.trim() !== "" && normalizePrintNumber(printNumber) === null;
        return setStatus(nameBad || !numberBad ? "printName" : "printNumber");
      }
      if (!ack) return setStatus("printAck");
    }
    const max = Math.min(CART_MAX_QUANTITY, variant.stock);
    if (inCart >= max) {
      setStatus("max");
      return;
    }
    setStatus(addToCart(variant.id, 1, max, print) > 0 ? "added" : "full");
  }

  const preview = (() => {
    const p = parsePrint({ name: printName, number: printNumber });
    return p ? printText(p, t("printNumberShort")) : "";
  })();

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

      {canPersonalize && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-white/15 p-3">
          <legend className="sr-only">{t("personalize")}</legend>
          <div className="flex items-start gap-2 text-sm text-neutral-200">
            <input
              id={`${uid}-perso`}
              type="checkbox"
              checked={personalize}
              onChange={(e) => {
                setPersonalize(e.target.checked);
                setStatus(null);
              }}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <label htmlFor={`${uid}-perso`} className="font-semibold">
              {t("personalize")}
              {product.personalizationPrice > 0 && (
                <span className="block text-xs font-normal text-neutral-400">
                  {t("personalizePrice", { price: formatEuros(product.personalizationPrice, locale) })}
                </span>
              )}
            </label>
          </div>

          {personalize && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                <div>
                  <label htmlFor={`${uid}-print-name`} className="mb-1 block text-xs font-semibold text-neutral-300">
                    {t("printNameLabel")}
                  </label>
                  <input
                    id={`${uid}-print-name`}
                    type="text"
                    value={printName}
                    onChange={(e) => {
                      setPrintName(e.target.value);
                      setStatus(null);
                    }}
                    maxLength={PRINT_NAME_MAX}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-describedby={`${uid}-print-name-hint`}
                    className={`${inputCls} uppercase`}
                  />
                  <p id={`${uid}-print-name-hint`} className="mt-1 text-xs text-neutral-400">
                    {t("printNameHint")}
                  </p>
                </div>
                <div>
                  <label htmlFor={`${uid}-print-number`} className="mb-1 block text-xs font-semibold text-neutral-300">
                    {t("printNumberLabel")}
                  </label>
                  <input
                    id={`${uid}-print-number`}
                    type="text"
                    inputMode="numeric"
                    value={printNumber}
                    onChange={(e) => {
                      setPrintNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 2));
                      setStatus(null);
                    }}
                    maxLength={2}
                    autoComplete="off"
                    aria-describedby={`${uid}-print-number-hint`}
                    className={inputCls}
                  />
                  <p id={`${uid}-print-number-hint`} className="mt-1 text-xs text-neutral-400">
                    {t("printNumberHint")}
                  </p>
                </div>
              </div>
              {preview && (
                <p className="rounded-md bg-white/5 px-3 py-2 text-center font-display text-sm tracking-wide text-white">
                  {t("printPreview", { text: preview })}
                </p>
              )}
              <div className="flex items-start gap-2 text-xs text-neutral-300">
                <input
                  id={`${uid}-print-ack`}
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => {
                    setAck(e.target.checked);
                    setStatus(null);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <label htmlFor={`${uid}-print-ack`}>{t("personalizeAck")}</label>
              </div>
            </>
          )}
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
        {status === "printEmpty" && <span className="text-xbz-red-light">{t("errPrintEmpty")}</span>}
        {status === "printName" && <span className="text-xbz-red-light">{t("errPrintName")}</span>}
        {status === "printNumber" && <span className="text-xbz-red-light">{t("errPrintNumber")}</span>}
        {status === "printAck" && <span className="text-xbz-red-light">{t("errPrintAck")}</span>}
      </p>
    </div>
  );
}
