import "server-only";

import { after } from "next/server";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";

import type { CartLine } from "@/lib/cart";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";
import { stripe } from "@/lib/stripe";
import { formatEuros } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { localizedPath, siteConfig } from "@/lib/site";

// Boutique : commandes, réservation du stock, paiement Stripe.
//
// Le parcours, et qui fait foi à chaque étape :
//  1. « Payer » (route /api/boutique/checkout) : la BASE réserve le stock et
//     fige prix et noms (shop_reserve_order), puis Stripe ouvre une page de
//     paiement pour exactement ces lignes-là ;
//  2. le client paie sur Stripe — ou abandonne ;
//  3. le WEBHOOK signé confirme (shop_mark_paid) ou rend le stock
//     (shop_release_order). Jamais la page de retour : elle peut être forgée,
//     ou ne jamais s'afficher (onglet fermé).
// Filet : une réservation dont le webhook se serait perdu est rendue au
// passage suivant (sweepStaleReservations), après vérification chez Stripe.

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Durée d'une réservation, en minutes. Stripe impose au moins 30 min avant
 * l'expiration d'une page de paiement ; 32 laisse la marge du trajet.
 */
export const RESERVATION_MINUTES = 32;

/** Pays de livraison (Stripe refuse les autres adresses). */
export const SHIPPING_COUNTRIES = ["FR", "BE", "LU", "CH", "MC", "DE", "ES", "IT", "NL", "PT"] as const;

/** Cookie (httpOnly) qui retient la commande en cours de ce navigateur. */
export const CHECKOUT_COOKIE = "xbz_checkout";

/** Frais de port par commande, en euros (SHIPPING_FLAT_EUR, défaut 4,90). */
export function shippingEuros(): number {
  const raw = process.env.SHIPPING_FLAT_EUR;
  const euros = raw === undefined || raw.trim() === "" ? 4.9 : Number(raw.replace(",", "."));
  return Number.isFinite(euros) && euros >= 0 ? Math.round(euros * 100) / 100 : 4.9;
}

export type OrderItem = {
  variant_id: string;
  product_id: string;
  slug: string;
  name: string;
  size: string;
  quantity: number;
  unit_amount: number; // centimes
  image: string | null;
};

export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

export type Order = {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number | string;
  shipping: number | string;
  currency: string;
  locale: string;
  expires_at: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  amount_total: number | string | null;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Record<string, string | null> | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  /** Montant remboursé (€), total ou partiel. Absent tant que la migration d'export n'est pas passée. */
  refunded_amount?: number | string | null;
};

/** Numéro de commande lisible (reçu, back-office, formulaire de rétractation). */
export function orderNumber(id: string): string {
  return `XBZ-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

const cents = (euros: number | string) => Math.round(Number(euros) * 100);

/**
 * Le stock a changé : catalogue et pages boutique à rafraîchir.
 * `expire: 0` et non "max" : le visiteur suivant doit voir le stock RÉEL
 * (une taille qui vient de partir s'affiche épuisée), pas l'ancienne version
 * servie le temps de la régénération.
 */
function stockChanged(): void {
  revalidateTag(CACHE_TAGS.products, { expire: 0 });
  revalidateLocalizedPath("/boutique");
  revalidateLocalizedPath("/boutique/panier");
  // Pages produit : le stock (« épuisée », « plus que 2 pièces ») y est affiché.
  revalidateLocalizedPath("/boutique/[slug]");
}

// --- 1. Réservation --------------------------------------------------------

export type ReserveResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "stock"; unavailable: string[] }
  | { ok: false; reason: "invalid" | "error" };

/** Réserve le stock et crée la commande « pending » (tout ou rien). */
export async function reserveOrder(admin: Admin, lines: CartLine[], locale: string): Promise<ReserveResult> {
  const { data, error } = await admin.rpc("shop_reserve_order", {
    p_items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
    p_shipping: shippingEuros(),
    p_locale: locale,
    p_ttl_minutes: RESERVATION_MINUTES,
  });
  if (!error && data) {
    stockChanged();
    return { ok: true, order: data as Order };
  }
  if (error?.message === "shop:stock") {
    let unavailable: string[] = [];
    try {
      const parsed: unknown = JSON.parse(error.details ?? "[]");
      if (Array.isArray(parsed)) unavailable = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // Détail illisible : la page relira le catalogue.
    }
    return { ok: false, reason: "stock", unavailable };
  }
  if (error?.message === "shop:quantity" || error?.message === "shop:empty") return { ok: false, reason: "invalid" };
  console.error("[shop] réservation:", error?.message ?? "aucune donnée");
  return { ok: false, reason: "error" };
}

// --- 2. Page de paiement Stripe --------------------------------------------

export type CheckoutTexts = {
  /** « Taille {size} » */
  size: (size: string) => string;
  shipping: string;
  submit: string;
};

/**
 * Paramètres de la page de paiement : EXACTEMENT les lignes figées par la
 * base (noms, tailles, prix), le port, l'expiration de la réservation.
 */
export function buildCheckoutParams(order: Order, texts: CheckoutTexts): Stripe.Checkout.SessionCreateParams {
  const locale = order.locale === "en" ? "en" : "fr";
  return {
    mode: "payment",
    locale,
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    // Retrouvé sur le paiement lui-même (remboursement depuis le tableau de bord).
    payment_intent_data: { metadata: { order_id: order.id, order_number: orderNumber(order.id) } },
    // Carte bancaire (Apple Pay et Google Pay compris) : paiement immédiat,
    // pas de moyen « différé » qui garderait le stock bloqué des jours.
    payment_method_types: ["card"],
    line_items: order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "eur",
        unit_amount: item.unit_amount,
        product_data: {
          name: item.size ? `${item.name} — ${texts.size(item.size)}` : item.name,
          ...(item.image && /^https:\/\//.test(item.image) ? { images: [item.image] } : {}),
          metadata: { variant_id: item.variant_id },
        },
      },
    })),
    shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: cents(order.shipping), currency: "eur" },
          display_name: texts.shipping,
        },
      },
    ],
    custom_text: { submit: { message: texts.submit } },
    // La page de paiement expire avec la réservation : impossible de payer un
    // stock déjà rendu.
    ...(order.expires_at ? { expires_at: Math.floor(new Date(order.expires_at).getTime() / 1000) } : {}),
    success_url: `${siteConfig.url}${localizedPath("/boutique/merci", locale)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteConfig.url}${localizedPath("/boutique/panier", locale)}?annule=1`,
  };
}

// --- 3. Fin de parcours : payé, abandonné, remboursé -----------------------

/** Rend le stock d'une commande en attente (vrai si c'est cet appel qui l'a rendu). */
async function release(admin: Admin, orderId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("shop_release_order", { p_order: orderId });
  if (error) {
    console.error("[shop] libération:", error.message);
    return false;
  }
  if (data === true) stockChanged();
  return data === true;
}

/**
 * Abandon d'une commande en attente : la page de paiement est fermée chez
 * Stripe AVANT de rendre le stock — sinon on pourrait encore payer des pièces
 * revendues entre-temps. Si Stripe dit que c'est déjà payé, on enregistre le
 * paiement au lieu de rendre quoi que ce soit.
 */
export async function abandonOrder(admin: Admin, orderId: string): Promise<boolean> {
  const { data: order } = await admin
    .from("orders")
    .select("id, status, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "pending") return false;

  if (order.stripe_session_id) {
    try {
      await stripe().checkout.sessions.expire(order.stripe_session_id);
    } catch {
      // Déjà expirée… ou déjà payée : on demande à Stripe où elle en est.
      const session = await stripe()
        .checkout.sessions.retrieve(order.stripe_session_id)
        .catch(() => null);
      if (!session) return false; // dans le doute, on ne rend rien : le filet repassera
      if (session.status === "complete") {
        if (session.payment_status === "paid") await recordPayment(admin, session);
        return false;
      }
      if (session.status !== "expired") return false;
    }
  }
  return release(admin, orderId);
}

/** Webhook « expirée » / « paiement échoué » : la page est déjà close, on rend. */
export async function releaseFromSession(admin: Admin, session: Stripe.Checkout.Session): Promise<boolean> {
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  return orderId ? release(admin, orderId) : false;
}

/** Enregistre le paiement d'une session payée. Idempotent (webhook rejoué). */
export async function recordPayment(
  admin: Admin,
  session: Stripe.Checkout.Session,
): Promise<"paid" | "paid_late" | "already" | "missing" | "unpaid"> {
  if (session.payment_status !== "paid") return "unpaid";
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) return "missing";

  const shipping = session.collected_information?.shipping_details ?? null;
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  const { data, error } = await admin.rpc("shop_mark_paid", {
    p_order: orderId,
    p_session: session.id,
    p_payment_intent: paymentIntent,
    p_amount: (session.amount_total ?? 0) / 100,
    p_email: session.customer_details?.email ?? null,
    p_name: shipping?.name ?? session.customer_details?.name ?? null,
    p_address: shipping?.address ?? null,
  });
  if (error) throw new Error(error.message);

  const result = data as "paid" | "paid_late" | "already" | "missing";
  if (result === "paid" || result === "paid_late") {
    if (result === "paid_late") stockChanged();
    revalidateLocalizedPath("/admin/commandes");
    notifyStaff(admin, orderId, result === "paid_late");
  }
  return result;
}

/**
 * Remboursement fait depuis Stripe : total → « refunded », partiel → note.
 * Dans les deux cas, le montant remboursé est gardé (comptabilité, export).
 *
 * Stripe ne garantit pas l'ordre des événements : `charge.refunded` peut
 * arriver AVANT que le paiement soit enregistré (webhook « payé » en retard ou
 * en nouvel essai). La commande n'a alors pas encore son identifiant de
 * paiement, la mise à jour ne trouve rien, et répondre 200 perdrait ce
 * remboursement pour de bon. Dans ce cas on lève une erreur : Stripe rejoue
 * l'événement, et cette fois le paiement est enregistré.
 */
export async function recordRefund(admin: Admin, charge: Stripe.Charge): Promise<void> {
  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null);
  if (!paymentIntent) return;

  const amount = (charge.amount_refunded ?? 0) / 100;
  const refunded = formatEuros(amount, "fr");
  // La note dit toujours le DERNIER état : un remboursement total efface la
  // mention d'un partiel antérieur.
  const update = charge.refunded
    ? { status: "refunded", refunded_at: new Date().toISOString(), note: `Remboursée en totalité : ${refunded} (voir Stripe).` }
    : { note: `Remboursement partiel : ${refunded} (voir Stripe).` };

  const write = (values: Record<string, unknown>) =>
    admin
      .from("orders")
      .update(values)
      .eq("stripe_payment_intent", paymentIntent)
      .in("status", ["paid", "fulfilled", "refunded"])
      .select("id");
  let { data, error } = await write({ ...update, refunded_amount: amount });
  // Migration d'export pas encore passée : on enregistre le remboursement sans
  // le montant plutôt que de perdre l'événement.
  if (error?.code === "42703") ({ data, error } = await write(update));
  if (error) throw new Error(error.message);

  if (!data?.length) {
    // Aucune commande payée avec ce paiement. Le paiement est-il simplement en
    // retard ? Les paiements du site portent `order_id` (voir
    // buildCheckoutParams). On le lit sur le paiement lui-même, la source sûre :
    // une erreur réseau ici fait aussi réessayer Stripe.
    const orderId =
      charge.metadata?.order_id ?? (await stripe().paymentIntents.retrieve(paymentIntent)).metadata?.order_id;
    if (orderId) {
      const { data: order } = await admin.from("orders").select("id, status").eq("id", orderId).maybeSingle();
      if (order && order.status === "pending") {
        throw new Error(`remboursement reçu avant l'enregistrement du paiement (commande ${orderNumber(orderId)})`);
      }
    }
    // Sinon : paiement étranger à la boutique (ou commande inconnue), rien à faire.
    return;
  }
  revalidateLocalizedPath("/admin/commandes");
}

// --- 4. Filet de sécurité ---------------------------------------------------

/**
 * Rend les réservations dépassées dont le webhook « expirée » se serait perdu
 * (secret mal configuré, panne). Chaque cas est vérifié chez Stripe avant :
 * une session payée est enregistrée, jamais rendue. Appelé au fil des
 * paiements et par le cron quotidien.
 */
export async function sweepStaleReservations(admin: Admin, limit = 10): Promise<number> {
  const before = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .eq("status", "pending")
    .lt("expires_at", before)
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[shop] filet:", error.message);
    return 0;
  }
  let released = 0;
  for (const { id } of data ?? []) {
    try {
      if (await abandonOrder(admin, id)) released += 1;
    } catch (e) {
      console.error("[shop] filet, commande", id, e);
    }
  }
  return released;
}

// --- 5. Notification au staff ----------------------------------------------

/**
 * Prévient le staff sur Discord (DISCORD_COMMANDES_WEBHOOK_URL), après la
 * réponse. Le message liste les articles et le montant, SANS nom, email ni
 * adresse : ils restent dans le back-office, pas dans un salon Discord.
 */
function notifyStaff(admin: Admin, orderId: string, late: boolean): void {
  const url = process.env.DISCORD_COMMANDES_WEBHOOK_URL;
  if (!url) return;
  after(async () => {
    try {
      const { data: order } = await admin
        .from("orders")
        .select("id, items, amount_total, shipping_address")
        .eq("id", orderId)
        .maybeSingle();
      if (!order) return;
      const items = (order.items as OrderItem[])
        .map((i) => `• ${i.quantity} × ${i.name}${i.size ? ` (${i.size})` : ""}`)
        .join("\n");
      const country = (order.shipping_address as Record<string, string | null> | null)?.country ?? "?";
      const total = formatEuros(Number(order.amount_total ?? 0), "fr");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "XBZ · Boutique",
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: `🛒 Nouvelle commande ${orderNumber(order.id)}`,
              description: `${items}\n\n**Total : ${total}** · livraison ${country}${
                late ? "\n⚠️ Payée après la fin de la réservation : vérifier le stock avant d'expédier." : ""
              }`,
              url: `${siteConfig.url}${localizedPath("/admin/commandes", "fr")}`,
              color: late ? 0xfccd05 : 0xdc2515,
            },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) console.error("[shop] notification Discord:", res.status);
    } catch (e) {
      console.error("[shop] notification Discord:", e);
    }
  });
}
