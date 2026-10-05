import "server-only";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";

import { LEGAL } from "@/lib/legal";
import { sendMail, isMailConfigured } from "@/lib/mailer";
import { orderNumber } from "@/lib/shop";
import { localizedPath, siteConfig } from "@/lib/site";
import type { createAdminClient } from "@/lib/supabase/admin";
import { buildAck } from "@/lib/withdrawal";

// Côté serveur de la rétractation en ligne : envoi de l'accusé de réception,
// nouvelle tentative, alerte du staff. La route publique, le cron quotidien et
// le bouton « Renvoyer l'accusé » du back-office passent tous par ici.

type Admin = ReturnType<typeof createAdminClient>;

/** Essais d'envoi au total (le premier, puis un par passage du cron). */
export const MAX_ACK_ATTEMPTS = 5;

/**
 * Accusés envoyés au plus à une même adresse en 24 h. Sans plafond, la route
 * publique servirait à noyer la boîte de n'importe qui sous des e-mails venant
 * de notre domaine. Un vrai client ne se rétracte pas quatre fois par jour ; la
 * déclaration au-delà est quand même ENREGISTRÉE (le staff la voit), seul l'envoi
 * automatique est suspendu.
 */
export const MAX_ACK_PER_EMAIL_PER_DAY = 3;

export type AckResult = { sent: boolean; error?: string };

type Row = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  customer_name: string;
  customer_email: string;
  details: string | null;
  locale: string;
  received_at: string;
  ack_sent_at: string | null;
  ack_attempts: number;
  ack_error: string | null;
};

/**
 * Envoie (ou renvoie) l'accusé de réception d'une déclaration, et note le résultat.
 * Sans effet si l'accusé est déjà parti. Ne lève jamais.
 *
 * Une déclaration qui a épuisé ses essais (ou dépassé le plafond par adresse) n'est
 * renvoyée que sur ordre du staff (`force`, bouton du back-office).
 */
export async function sendAck(admin: Admin, id: string, opts: { force?: boolean } = {}): Promise<AckResult> {
  try {
    const { data, error } = await admin
      .from("order_withdrawals")
      .select(
        "id, order_id, order_number, customer_name, customer_email, details, locale, received_at, ack_sent_at, ack_attempts, ack_error",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return { sent: false, error: `lecture impossible (${error.code ?? "?"})` };
    const row = data as Row | null;
    if (!row) return { sent: false, error: "déclaration introuvable" };
    if (row.ack_sent_at) return { sent: true };
    if (!opts.force && row.ack_attempts >= MAX_ACK_ATTEMPTS) {
      return { sent: false, error: row.ack_error ?? "envoi automatique suspendu" };
    }

    const locale = row.locale === "en" ? "en" : "fr";
    const t = await getTranslations({ locale, namespace: "withdrawalMail" });
    const mail = buildAck(t, {
      locale,
      name: row.customer_name,
      email: row.customer_email,
      orderNumber: row.order_number ?? (row.order_id ? orderNumber(row.order_id) : null),
      details: row.details,
      receivedAt: new Date(row.received_at),
      returnAddress: LEGAL.returnAddress,
      association: LEGAL.name,
      address: LEGAL.address,
      contactEmail: LEGAL.email,
      termsUrl: `${siteConfig.url}${localizedPath("/cgv", locale)}#retractation`,
    });

    const result = await sendMail({ to: row.customer_email, replyTo: LEGAL.email, ...mail });
    const attempts = row.ack_attempts + 1;
    const { error: updateError } = await admin
      .from("order_withdrawals")
      .update(
        result.ok
          ? { ack_sent_at: new Date().toISOString(), ack_attempts: attempts, ack_error: null }
          : { ack_attempts: attempts, ack_error: result.error },
      )
      .eq("id", id);
    if (updateError) console.error("[retractation] suivi de l'accusé:", updateError.message);
    if (!result.ok) console.error("[retractation] accusé non envoyé:", id, result.error);
    return result.ok ? { sent: true } : { sent: false, error: result.error };
  } catch (e) {
    console.error("[retractation] accusé, erreur inattendue:", id, e);
    return { sent: false, error: "erreur inattendue" };
  }
}

/**
 * Alerte le staff sur Discord (DISCORD_COMMANDES_WEBHOOK_URL). Comme pour les
 * commandes : ni nom, ni e-mail, ni adresse dans le message — ils restent dans le
 * back-office.
 */
export async function notifyWithdrawal(admin: Admin, id: string, ack: AckResult): Promise<void> {
  const url = process.env.DISCORD_COMMANDES_WEBHOOK_URL;
  if (!url) return;
  try {
    const { data } = await admin
      .from("order_withdrawals")
      .select("order_id, order_number, match")
      .eq("id", id)
      .maybeSingle();
    const row = data as Pick<Row, "order_id" | "order_number"> & { match: string } | null;
    const number = row?.order_id ? orderNumber(row.order_id) : null;
    const which = number
      ? `Commande **${number}**${row?.match === "single" ? " (seule commande payée de cet e-mail)" : ""}`
      : row?.order_number
        ? `Commande saisie : **${row.order_number}** — non reconnue`
        : "Commande non identifiée";
    const needsCheck = !number;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "XBZ · Boutique",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: "↩️ Rétractation reçue",
            description: [
              which + (needsCheck ? " : à rapprocher à la main dans le back-office." : "."),
              ack.sent
                ? "Accusé de réception envoyé au client ✅"
                : `⚠️ Accusé de réception NON envoyé (${ack.error ?? "raison inconnue"}) : renvoie-le depuis le back-office.`,
            ].join("\n"),
            url: `${siteConfig.url}${localizedPath("/admin/commandes?vue=retractations", "fr")}`,
            color: ack.sent && !needsCheck ? 0xfccd05 : 0xdc2515,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[retractation] notification Discord:", res.status);
  } catch (e) {
    console.error("[retractation] notification Discord:", e);
  }
}

/** Après la réponse au client : accusé de réception, puis alerte du staff. */
export function finishWithdrawalAfterResponse(admin: Admin, id: string): void {
  after(async () => {
    const ack = await sendAck(admin, id);
    await notifyWithdrawal(admin, id, ack);
  });
}

/**
 * Filet : renvoie les accusés restés sans réponse (fournisseur en panne, clé
 * manquante au moment de la déclaration…). Appelé par le cron quotidien.
 */
export async function retryPendingAcks(admin: Admin, limit = 20): Promise<number> {
  if (!isMailConfigured()) return 0;
  const { data, error } = await admin
    .from("order_withdrawals")
    .select("id")
    .is("ack_sent_at", null)
    .lt("ack_attempts", MAX_ACK_ATTEMPTS)
    .order("received_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[retractation] filet:", error.message);
    return 0;
  }
  let sent = 0;
  for (const { id } of (data ?? []) as { id: string }[]) {
    if ((await sendAck(admin, id)).sent) sent += 1;
  }
  return sent;
}
