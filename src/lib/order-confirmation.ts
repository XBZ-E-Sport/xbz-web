import "server-only";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";

import { LEGAL } from "@/lib/legal";
import { sendMail } from "@/lib/mailer";
import { buildOrderConfirmation, type ConfirmationItem } from "@/lib/order-mail";
import { orderNumber } from "@/lib/order-number";
import { localizedPath, siteConfig } from "@/lib/site";
import type { createAdminClient } from "@/lib/supabase/admin";

// E-mail de confirmation de commande, côté serveur : envoi, nouvelle tentative, filet
// quotidien. Il part APRÈS le paiement (jamais pendant : un fournisseur d'e-mails en
// panne ne doit pas faire échouer le webhook de Stripe), en plus du reçu de Stripe.
//
// Le suivi (`orders.confirmation_sent_at` / `confirmation_error`) vient de la migration
// `migration_confirmation_commande_06102026.sql` ; sans elle, l'e-mail part quand même, une
// seule fois, sans reprise possible.

type Admin = ReturnType<typeof createAdminClient>;

export type ConfirmationResult = { sent: boolean; error?: string };

type Row = {
  id: string;
  status: string;
  items: ConfirmationItem[] | null;
  subtotal: number | string | null;
  shipping: number | string | null;
  amount_total: number | string | null;
  locale: string;
  customer_email: string | null;
  customer_name: string | null;
  confirmation_sent_at?: string | null;
};

const BASE = "id, status, items, subtotal, shipping, amount_total, locale, customer_email, customer_name";
/** Colonne absente (Postgres) : la migration n'est pas passée. */
const MISSING_COLUMN = "42703";

/** Une panne passagère du fournisseur (limite de débit, erreur serveur, réseau) : un second essai a une chance. */
const TRANSIENT = /HTTP (429|5\d\d)|injoignable/;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envoie (ou renvoie, avec `force`) la confirmation d'une commande PAYÉE et en note le
 * résultat. Sans effet si elle est déjà partie. Ne lève jamais.
 */
export async function sendOrderConfirmation(
  admin: Admin,
  orderId: string,
  opts: { force?: boolean } = {},
): Promise<ConfirmationResult> {
  try {
    let tracked = true;
    let res = await admin.from("orders").select(`${BASE}, confirmation_sent_at`).eq("id", orderId).maybeSingle();
    if (res.error?.code === MISSING_COLUMN) {
      tracked = false;
      res = await admin.from("orders").select(BASE).eq("id", orderId).maybeSingle();
    }
    if (res.error) return { sent: false, error: `lecture impossible (${res.error.code ?? "?"})` };
    const order = res.data as Row | null;
    if (!order) return { sent: false, error: "commande introuvable" };
    if (order.status !== "paid" && order.status !== "fulfilled") return { sent: false, error: "commande non payée" };
    if (tracked && order.confirmation_sent_at && !opts.force) return { sent: true };
    if (!order.customer_email) return { sent: false, error: "aucune adresse e-mail sur la commande" };

    const locale = order.locale === "en" ? "en" : "fr";
    const t = await getTranslations({ locale, namespace: "orderMail" });
    const shipping = Number(order.shipping ?? 0);
    const mail = buildOrderConfirmation(t, {
      locale,
      name: order.customer_name,
      orderNumber: orderNumber(order.id),
      items: Array.isArray(order.items) ? order.items : [],
      shipping,
      total: Number(order.amount_total ?? Number(order.subtotal ?? 0) + shipping),
      deliveryDays: LEGAL.deliveryDays,
      association: LEGAL.name,
      address: LEGAL.address,
      contactEmail: LEGAL.email,
      termsUrl: `${siteConfig.url}${localizedPath("/cgv", locale)}`,
      withdrawalUrl: `${siteConfig.url}${localizedPath("/boutique/retractation", locale)}`,
    });

    const result = await sendMail({ to: order.customer_email, replyTo: LEGAL.email, ...mail });
    if (tracked) {
      const { error } = await admin
        .from("orders")
        .update(
          result.ok
            ? { confirmation_sent_at: new Date().toISOString(), confirmation_error: null }
            : { confirmation_error: result.error },
        )
        .eq("id", orderId);
      if (error) console.error("[boutique] suivi de la confirmation:", error.message);
    }
    if (!result.ok) console.error("[boutique] confirmation non envoyée:", orderNumber(orderId), result.error);
    return result.ok ? { sent: true } : { sent: false, error: result.error };
  } catch (e) {
    console.error("[boutique] confirmation, erreur inattendue:", orderId, e);
    return { sent: false, error: "erreur inattendue" };
  }
}

/** Après la réponse à Stripe : un envoi, et un second quelques secondes plus tard sur une panne passagère. */
export function sendOrderConfirmationAfterResponse(admin: Admin, orderId: string): void {
  after(async () => {
    const first = await sendOrderConfirmation(admin, orderId);
    if (!first.sent && TRANSIENT.test(first.error ?? "")) {
      await sleep(3_000);
      await sendOrderConfirmation(admin, orderId);
    }
  });
}

/** Une commande payée depuis moins de ce délai est laissée à l'envoi immédiat (pas de double envoi). */
const SETTLE_MINUTES = 15;
/** Au-delà de ce délai, on n'insiste plus : le staff peut renvoyer à la main. */
const GIVE_UP_DAYS = 3;

/**
 * Filet quotidien : renvoie les confirmations dont un PREMIER envoi a échoué
 * (`confirmation_error` renseignée). Une commande jamais tentée — payée avant la mise en
 * service de cette fonction — n'est pas concernée : aucun e-mail surprise. Renvoie le
 * nombre de confirmations parties ; 0 si la migration n'est pas passée.
 */
export async function retryPendingConfirmations(admin: Admin, limit = 10): Promise<number> {
  const now = Date.now();
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .in("status", ["paid", "fulfilled"])
    .is("confirmation_sent_at", null)
    .not("confirmation_error", "is", null)
    .not("customer_email", "is", null)
    .gte("paid_at", new Date(now - GIVE_UP_DAYS * 24 * 3600_000).toISOString())
    .lte("paid_at", new Date(now - SETTLE_MINUTES * 60_000).toISOString())
    .order("paid_at", { ascending: true })
    .limit(limit);
  if (error) {
    if (error.code !== MISSING_COLUMN) console.error("[boutique] filet des confirmations:", error.message);
    return 0;
  }
  const results = await Promise.all((data ?? []).map((o: { id: string }) => sendOrderConfirmation(admin, o.id)));
  return results.filter((r) => r.sent).length;
}
