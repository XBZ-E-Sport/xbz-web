"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
// Types seulement : lib/boutique tire le client Supabase serveur.
import type { Product, ProductVariant } from "@/lib/boutique";
import { CART_MAX_QUANTITY, CHECKOUT_OPEN_COOKIE, lineKey, type CartLine } from "@/lib/cart";
import { LEGAL } from "@/lib/legal";
import { removeFromCart, setCartQuantity, useCart } from "@/lib/cart-store";
import { formatEuros } from "@/lib/money";
import { printText } from "@/lib/personalization";

/** Ce dont le panier a besoin du catalogue (rien de plus ne part au navigateur). */
export type CartProduct = Pick<
  Product,
  "slug" | "name" | "price" | "image" | "icon" | "available" | "personalizable" | "personalizationPrice"
> & {
  variants: ProductVariant[];
};

type Row = {
  line: CartLine;
  product: CartProduct | null;
  variant: ProductVariant | null;
  /** Hors vente, épuisée, supprimée, ou refusée par le serveur au paiement. */
  unavailable: boolean;
  /** Personnalisation que le produit ne propose plus (interrupteur éteint depuis l'ajout). */
  printOff: boolean;
  /** Pièces que cette ligne peut encore atteindre : stock de la taille, autres lignes de la taille déduites. */
  max: number;
  /** Pièces disponibles pour TOUTE la taille (stock affiché, 10 au plus). */
  cap: number;
  /** Prix unitaire, supplément de personnalisation compris. */
  unit: number;
};

// Codes d'erreur de /api/boutique/checkout → clés de traduction.
const ERRORS: Record<string, string> = {
  unavailable: "errClosed",
  rateLimited: "errRate",
  invalid: "errInvalid",
  terms: "errTerms",
  stock: "errStock",
  payment: "errPayment",
  forbidden: "errInvalid",
  personalization: "errPersonalization",
};

const noop = () => () => {};

/** Retour depuis une page de paiement : « Annuler » sur Stripe, ou cookie. */
function readCheckoutReturn(): { back: boolean; open: boolean } {
  try {
    return {
      back: new URLSearchParams(window.location.search).has("annule"),
      open: document.cookie.split("; ").some((c) => c.startsWith(`${CHECKOUT_OPEN_COOKIE}=`)),
    };
  } catch {
    return { back: false, open: false };
  }
}

export default function CartView({
  products,
  shipping,
  open,
}: {
  products: CartProduct[];
  shipping: number;
  /** Paiement en ligne activé (Stripe configuré). */
  open: boolean;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const lines = useCart();
  // Le panier vit dans le navigateur : avant l'hydratation, on ne sait pas
  // s'il est vide. On n'affiche donc « panier vide » qu'une fois monté.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<Set<string>>(() => new Set());
  const [cancelled, setCancelled] = useState(false);
  // Réservation de ce navigateur en cours de restitution, puis catalogue relu.
  // Lu dès le premier rendu client : rien du panier ne doit s'afficher (ni
  // être corrigé) sur la base d'un stock qui décompte encore ses articles.
  const [releasing, setReleasing] = useState(() => {
    if (typeof window === "undefined") return false;
    const r = readCheckoutReturn();
    return r.back || r.open;
  });
  const [refreshing, startRefresh] = useTransition();
  const settling = releasing || refreshing;

  const index = useMemo(() => {
    const map = new Map<string, { product: CartProduct; variant: ProductVariant }>();
    for (const product of products) for (const variant of product.variants) map.set(variant.id, { product, variant });
    return map;
  }, [products]);

  const rows: Row[] = useMemo(
    () =>
      lines.map((line) => {
        const hit = index.get(line.variantId) ?? null;
        const cap = hit ? Math.min(CART_MAX_QUANTITY, hit.variant.stock) : 0;
        // Les autres lignes de la même taille (autre texte imprimé) partagent le même stock.
        const others = lines.reduce(
          (n, l) =>
            l.variantId === line.variantId && l !== line && !(l.print && hit && !hit.product.personalizable)
              ? n + l.quantity
              : n,
          0,
        );
        const max = Math.max(0, cap - others);
        const printOff = Boolean(line.print && hit && !hit.product.personalizable);
        const unavailable =
          !hit || !open || !hit.product.available || cap <= 0 || refused.has(line.variantId) || printOff;
        const unit = hit ? hit.product.price + (line.print ? hit.product.personalizationPrice : 0) : 0;
        return { line, product: hit?.product ?? null, variant: hit?.variant ?? null, unavailable, printOff, max, cap, unit };
      }),
    [lines, index, open, refused],
  );
  const payable = rows.filter((r) => !r.unavailable);
  const subtotal = payable.reduce((sum, r) => sum + r.unit * r.line.quantity, 0);
  // Pièces personnalisées payables : accordent « un article » / « N articles » dans l'avertissement.
  const printCount = payable.reduce((n, r) => (r.line.print ? n + r.line.quantity : n), 0);
  const hasPrint = printCount > 0;
  const total = payable.length ? subtotal + shipping : 0;

  // Quantité au-delà du stock affiché (pièces vendues depuis l'ajout) : on la
  // ramène au disponible plutôt que de faire payer autre chose que ce qu'on voit.
  useEffect(() => {
    if (settling) return;
    // Le stock d'une taille se partage entre ses lignes, dans l'ordre du panier :
    // les premières gardent leurs pièces, les DERNIÈRES sont ramenées au reste.
    const left = new Map<string, number>();
    for (const r of rows) {
      if (r.unavailable) continue;
      const remaining = left.get(r.line.variantId) ?? r.cap;
      if (r.line.quantity > remaining) setCartQuantity(lineKey(r.line), remaining);
      left.set(r.line.variantId, Math.max(0, remaining - r.line.quantity));
    }
  }, [rows, settling]);

  // Retour depuis une page de paiement — « Annuler » sur Stripe (?annule=1) ou
  // simple retour arrière (cookie CHECKOUT_OPEN_COOKIE) : les articles de CE
  // navigateur sont encore réservés, donc décomptés du stock affiché. On rend
  // la réservation, PUIS on relit le catalogue ; d'ici là, le panier attend
  // au lieu d'afficher « plus disponible » ses propres articles.
  useEffect(() => {
    const { back, open } = readCheckoutReturn();
    if (!back && !open) return;
    // Lecture unique de l'adresse et des cookies au montage (système externe) :
    // c'est l'usage même d'un effet, que la règle ne distingue pas d'un rendu
    // en cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (back) setCancelled(true);
    fetch("/api/boutique/cancel", { method: "POST" })
      .then((res) => res.json())
      .catch(() => ({}))
      .then((data: { released?: boolean }) => {
        startRefresh(() => {
          // Adresse nettoyée PAR LE ROUTEUR (un `history.replaceState` direct
          // serait annulé par le rafraîchissement) : recharger la page ne
          // réannonce pas l'annulation.
          if (back) router.replace(window.location.pathname, { scroll: false });
          // Catalogue relu : le stock rendu s'affiche.
          if (data.released) router.refresh();
        });
      })
      .finally(() => setReleasing(false));
  }, [router]);

  async function pay() {
    if (!terms) {
      setError(t("errTerms"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boutique/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: payable.map((r) => ({
            variantId: r.line.variantId,
            quantity: r.line.quantity,
            ...(r.line.print ? { print: r.line.print } : {}),
          })),
          locale,
          terms: true,
        }),
      });
      const data: { ok?: boolean; url?: string; code?: string; unavailable?: string[] } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.ok && data.url) {
        // Départ vers la page de paiement Stripe (le bouton reste occupé).
        window.location.assign(data.url);
        return;
      }
      if (data.code === "stock") {
        setRefused(new Set(data.unavailable ?? []));
        router.refresh();
      }
      if (data.code === "personalization") router.refresh();
      setError(t(ERRORS[data.code ?? ""] ?? "errPayment"));
    } catch {
      setError(t("errNetwork"));
    }
    setBusy(false);
  }

  if (!mounted || (lines.length > 0 && settling)) {
    return (
      <p role="status" className="card-xbz p-10 text-center text-neutral-400">
        {t("loading")}
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="card-xbz flex flex-col items-center gap-5 p-10 text-center">
        {cancelled && <p role="status" className="text-sm text-xbz-cyan">{t("cancelled")}</p>}
        <p className="text-neutral-300">{t("empty")}</p>
        <Link
          href="/boutique"
          className="rounded-xl bg-xbz-blue px-7 py-3 font-bold text-white transition hover:brightness-110"
        >
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        {cancelled && (
          <p role="status" className="rounded-lg border border-xbz-cyan/30 bg-white/5 px-4 py-3 text-sm text-xbz-cyan">
            {t("cancelled")}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const name = r.product?.name ?? t("unknownItem");
            // Nom accessible des boutons : produit, taille ET texte imprimé — sans quoi deux lignes
            // de la même taille (ordinaire / personnalisée) auraient des boutons indiscernables.
            const label = [
              name,
              r.variant?.size ? t("size", { size: r.variant.size }) : "",
              r.line.print ? printText(r.line.print, t("printNumberShort")) : "",
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={lineKey(r.line)} className="card-xbz flex gap-4 p-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-xbz-blue/20 to-xbz-cyan/10">
                  {r.product?.image ? (
                    <Image src={r.product.image} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <span aria-hidden="true" className="text-3xl">
                      {r.product?.icon || "🛒"}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-base text-xbz-red-light">
                      {r.product ? (
                        <Link href={`/boutique/${r.product.slug}`} className="hover:underline underline-offset-4">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </h2>
                    {!r.unavailable && r.product && (
                      <span className="font-bold text-white">{formatEuros(r.unit * r.line.quantity, locale)}</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400">
                    {r.variant?.size ? `${t("size", { size: r.variant.size })} · ` : ""}
                    {r.product ? t("unitPrice", { price: formatEuros(r.unit, locale) }) : ""}
                  </p>
                  {r.line.print && (
                    <p className="text-sm text-neutral-200">
                      <span aria-hidden="true">✏️ </span>
                      {t("printLine", { text: printText(r.line.print, t("printNumberShort")) })}
                      {r.product && r.product.personalizationPrice > 0 && (
                        <span className="text-neutral-400">
                          {" "}
                          {t("printIncluded", { price: formatEuros(r.product.personalizationPrice, locale) })}
                        </span>
                      )}
                    </p>
                  )}

                  {r.unavailable ? (
                    <p className="text-sm font-semibold text-xbz-red-light">
                      {r.printOff ? t("personalizationOff") : t("unavailable")}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="sr-only">{t("quantity")}</span>
                      <button
                        type="button"
                        onClick={() => setCartQuantity(lineKey(r.line), r.line.quantity - 1)}
                        aria-label={t("decrease", { name: label })}
                        className="h-8 w-8 rounded-md border border-white/20 font-bold text-white transition hover:border-white/50 hover:cursor-pointer"
                      >
                        −
                      </button>
                      <span aria-live="polite" className="min-w-6 text-center font-bold text-white">
                        {r.line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCartQuantity(lineKey(r.line), r.line.quantity + 1)}
                        disabled={r.line.quantity >= r.max}
                        aria-label={t("increase", { name: label })}
                        className="h-8 w-8 rounded-md border border-white/20 font-bold text-white transition hover:border-white/50 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(lineKey(r.line))}
                  aria-label={t("remove", { name: label })}
                  className="self-start rounded-md px-2 py-1 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white hover:cursor-pointer"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
        <Link href="/boutique" className="self-start text-sm font-semibold text-neutral-400 transition hover:text-white">
          <span aria-hidden="true">←</span> {t("backToShop")}
        </Link>
      </div>

      <aside aria-labelledby="cart-summary" className="card-xbz flex h-fit flex-col gap-4 p-6">
        <h2 id="cart-summary" className="font-display text-lg text-white">
          {t("summary")}
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-neutral-300">
            <dt>{t("subtotal")}</dt>
            <dd>{formatEuros(subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between text-neutral-300">
            <dt>{t("shipping")}</dt>
            <dd>{payable.length ? formatEuros(shipping, locale) : "—"}</dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white">
            <dt>{t("total")}</dt>
            <dd>{formatEuros(total, locale)}</dd>
          </div>
        </dl>
        <p className="text-xs text-neutral-400">{t("shippingNote", { days: LEGAL.deliveryDays })}</p>
        {hasPrint && (
          <p role="note" className="rounded-lg border border-xbz-cyan/40 bg-white/5 px-3 py-2 text-sm text-white">
            {t("personalizedNotice", { count: printCount })}
          </p>
        )}

        {open ? (
          <>
            <div className="flex items-start gap-2 text-sm text-neutral-300">
              <input
                id="cart-terms"
                type="checkbox"
                checked={terms}
                onChange={(e) => {
                  setTerms(e.target.checked);
                  setError(null);
                }}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <label htmlFor="cart-terms">
                {t.rich(hasPrint ? "termsPrint" : "terms", {
                  cgv: (chunks) => (
                    <Link href="/cgv" className="font-semibold text-xbz-cyan underline underline-offset-2">
                      {chunks}
                    </Link>
                  ),
                })}
              </label>
            </div>
            <button
              type="button"
              onClick={pay}
              disabled={busy || payable.length === 0}
              className="rounded-xl bg-xbz-blue px-6 py-3.5 text-center font-bold text-white transition hover:brightness-110 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t("paying") : t("pay", { amount: formatEuros(total, locale) })}
            </button>
            <p className="text-xs text-neutral-400">{t("secure")}</p>
          </>
        ) : (
          <p role="status" className="rounded-lg border border-xbz-cyan/30 bg-white/5 px-4 py-3 text-sm text-xbz-cyan">
            {t("errClosed")}
          </p>
        )}

        <p aria-live="assertive" className="text-sm font-semibold text-xbz-red-light">
          {error}
        </p>
      </aside>
    </div>
  );
}
