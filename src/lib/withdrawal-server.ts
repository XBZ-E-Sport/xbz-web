import "server-only";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";

import { LEGAL } from "@/lib/legal";
import { sendMail, isMailConfigured } from "@/lib/mailer";
import { orderNumber } from "@/lib/shop";
import { localizedPath, siteConfig } from "@/lib/site";
import type { createAdminClient } from "@/lib/supabase/admin";
import { buildAck, normalizeOrderNumber } from "@/lib/withdrawal";

// Côté serveur de la rétractation en ligne : envoi de l'accusé de réception,
// nouvelle tentative, alerte du staff. La route publique, le cron quotidien et
// le bouton « Renvoyer l'accusé » du back-office passent tous par ici.
//
// Deux principes :
//  - une déclaration n'est JAMAIS jetée : si l'accusé ne peut pas partir tout de
//    suite (plafond, panne, doute), elle reste en base, marquée, et le staff ou le
//    cron la reprend ;
//  - l'envoi automatique est plafonné, parce que la route est publique et que
//    l'accusé reprend un texte saisi par le visiteur : sans plafond, elle servirait à
//    noyer n'importe quelle boîte sous des e-mails de notre domaine et à épuiser le
//    quota gratuit de Brevo, au détriment des vrais clients.

type Admin = ReturnType<typeof createAdminClient>;

/** Essais d'envoi au total (le premier, puis un par passage du cron). */
export const MAX_ACK_ATTEMPTS = 5;

/** Accusés envoyés au plus à une même BOÎTE aux lettres en 24 h (« +tag » et points de Gmail ramenés à une forme). */
export const MAX_ACK_PER_MAILBOX_PER_DAY = 3;

/**
 * Accusés automatiques au plus par 24 h, tous destinataires confondus : sous le quota
 * gratuit de Brevo (300 par jour), pour qu'un flot ne l'épuise pas.
 */
export const MAX_ACK_PER_DAY = 100;

/**
 * Part de ce plafond réservée aux déclarations NON rapprochées (`none`, `mismatch`) : des
 * adresses jetables n'ont jamais de commande payée, les vrais clients gardent donc leur
 * place dans le quota.
 */
export const MAX_UNMATCHED_ACK_PER_DAY = 40;

/** Durée du verrou posé pendant un envoi (une panne en plein envoi le libère seul). */
const HOLD_MINUTES = 10;
const DAY_MS = 24 * 3600_000;

/** Motif noté (et montré au staff) sur une déclaration au piège anti-bot rempli. */
export const SUSPECT_ERROR = "champ piège anti-bot rempli : à vérifier, puis renvoyer l'accusé à la main";

export type AckResult = { sent: boolean; error?: string };

type Row = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  match: string;
  customer_name: string;
  customer_email: string;
  details: string | null;
  locale: string;
  mailbox_key: string | null;
  suspect: boolean;
  received_at: string;
  ack_sent_at: string | null;
  ack_attempts: number;
  ack_error: string | null;
};

const COLUMNS =
  "id, order_id, order_number, match, customer_name, customer_email, details, locale, mailbox_key, suspect, received_at, ack_sent_at, ack_attempts, ack_error";

/** Accusés déjà partis ces dernières 24 h : `null` si le comptage échoue (on ne bride alors rien). */
async function sentLastDay(admin: Admin, only?: { mailbox?: string; unmatched?: boolean }): Promise<number | null> {
  let q = admin
    .from("order_withdrawals")
    .select("id", { count: "exact", head: true })
    .gte("ack_sent_at", new Date(Date.now() - DAY_MS).toISOString());
  if (only?.mailbox) q = q.eq("mailbox_key", only.mailbox);
  if (only?.unmatched) q = q.in("match", ["none", "mismatch"]);
  const { count, error } = await q;
  return error ? null : (count ?? 0);
}

/**
 * Pourquoi l'envoi AUTOMATIQUE doit attendre (plafonds), ou `null` s'il peut partir.
 * Ce n'est pas un échec : aucun essai n'est brûlé, la déclaration reste dans la file du
 * cron et part dès que la fenêtre de 24 h se libère.
 */
async function deferralReason(admin: Admin, row: Row): Promise<string | null> {
  if (row.mailbox_key) {
    const sent = await sentLastDay(admin, { mailbox: row.mailbox_key });
    if (sent !== null && sent >= MAX_ACK_PER_MAILBOX_PER_DAY) {
      return `plafond de ${MAX_ACK_PER_MAILBOX_PER_DAY} accusés par boîte aux lettres et par jour atteint : envoi différé`;
    }
  }
  const total = await sentLastDay(admin);
  if (total !== null && total >= MAX_ACK_PER_DAY) {
    return `plafond de ${MAX_ACK_PER_DAY} accusés par jour atteint : envoi différé`;
  }
  if (row.match === "none" || row.match === "mismatch") {
    const unmatched = await sentLastDay(admin, { unmatched: true });
    if (unmatched !== null && unmatched >= MAX_UNMATCHED_ACK_PER_DAY) {
      return `plafond de ${MAX_UNMATCHED_ACK_PER_DAY} accusés par jour pour les déclarations non rapprochées atteint : envoi différé`;
    }
  }
  return null;
}

/**
 * Envoie (ou renvoie) l'accusé de réception d'une déclaration, et note le résultat.
 * Sans effet si l'accusé est déjà parti ou en train de partir. Ne lève jamais.
 *
 * Sans `force` (route publique, cron) : une déclaration au piège rempli, aux essais
 * épuisés ou qui dépasserait un plafond n'est pas envoyée. Avec `force` (bouton du
 * back-office) : le staff décide, tout cela est ignoré.
 */
export async function sendAck(admin: Admin, id: string, opts: { force?: boolean } = {}): Promise<AckResult> {
  try {
    const { data, error } = await admin.from("order_withdrawals").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) return { sent: false, error: `lecture impossible (${error.code ?? "?"})` };
    const row = data as Row | null;
    if (!row) return { sent: false, error: "déclaration introuvable" };
    if (row.ack_sent_at) return { sent: true };

    if (!opts.force) {
      if (row.suspect) return { sent: false, error: SUSPECT_ERROR };
      if (row.ack_attempts >= MAX_ACK_ATTEMPTS) return { sent: false, error: row.ack_error ?? "essais épuisés" };
      const deferral = await deferralReason(admin, row);
      if (deferral) {
        await admin.from("order_withdrawals").update({ ack_error: deferral }).eq("id", id);
        return { sent: false, error: deferral };
      }
    }

    // Verrou : la route et le cron peuvent viser la même ligne en même temps. Une seule
    // mise à jour conditionnelle gagne ; l'autre n'envoie rien.
    const now = new Date().toISOString();
    let claim = admin
      .from("order_withdrawals")
      .update({ ack_hold_until: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString() })
      .eq("id", id)
      .is("ack_sent_at", null);
    if (!opts.force) claim = claim.or(`ack_hold_until.is.null,ack_hold_until.lt.${now}`);
    const { data: claimed, error: claimError } = await claim.select("id");
    if (claimError) return { sent: false, error: `verrou impossible (${claimError.code ?? "?"})` };
    if (!claimed?.length) return { sent: false, error: "envoi déjà en cours" };

    const locale = row.locale === "en" ? "en" : "fr";
    const t = await getTranslations({ locale, namespace: "withdrawalMail" });
    const mail = buildAck(t, {
      locale,
      name: row.customer_name,
      email: row.customer_email,
      // Le texte tapé par le client fait partie de sa déclaration ; à défaut, la commande rapprochée.
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
          ? { ack_sent_at: new Date().toISOString(), ack_attempts: attempts, ack_error: null, ack_hold_until: null }
          : { ack_attempts: attempts, ack_error: result.error, ack_hold_until: null },
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

/** Libellé court de la commande visée, SANS reprendre de texte libre du client. */
function describeOrder(row: Pick<Row, "order_id" | "order_number" | "match">): { text: string; needsCheck: boolean } {
  if (row.order_id) {
    const inferred = row.match === "single" ? " (seule commande payée de cet e-mail, à confirmer)" : "";
    return { text: `Commande **${orderNumber(row.order_id)}**${inferred}`, needsCheck: row.match === "single" };
  }
  const typed = row.order_number ? normalizeOrderNumber(row.order_number) : null;
  if (typed) return { text: `Numéro saisi **${typed}** : aucune commande payée de cet e-mail ne le porte`, needsCheck: true };
  return { text: "Commande non identifiée", needsCheck: true };
}

/**
 * Alerte le staff sur Discord (DISCORD_COMMANDES_WEBHOOK_URL). Comme pour les
 * commandes : ni nom, ni e-mail, ni texte libre du client dans le message — ils restent
 * dans le back-office.
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
    const { text, needsCheck } = describeOrder(
      (data as Pick<Row, "order_id" | "order_number" | "match"> | null) ?? { order_id: null, order_number: null, match: "none" },
    );

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
              `${text}${needsCheck ? " : à vérifier dans le back-office." : "."}`,
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Panne passagère du fournisseur (limite de débit, erreur serveur, réseau) : un second essai a une chance. */
const TRANSIENT = /HTTP (429|5\d\d)|injoignable/;

/**
 * Après la réponse au client : accusé de réception (un second essai quelques secondes
 * plus tard si le fournisseur a eu un accroc), puis alerte du staff avec le résultat.
 */
export function finishWithdrawalAfterResponse(admin: Admin, id: string): void {
  after(async () => {
    let ack = await sendAck(admin, id);
    if (!ack.sent && TRANSIENT.test(ack.error ?? "")) {
      await sleep(3_000);
      ack = await sendAck(admin, id);
    }
    await notifyWithdrawal(admin, id, ack);
  });
}

/** La table des déclarations existe-t-elle ? (migration passée) */
export async function withdrawalTableReady(admin: Admin): Promise<boolean> {
  const { error } = await admin.from("order_withdrawals").select("id").limit(1);
  return !error;
}

/**
 * Filet : renvoie les accusés restés sans réponse (fournisseur en panne, plafond levé
 * depuis…). Appelé par le cron quotidien. Les déclarations liées à une commande ou à un
 * numéro passent avant celles qui ne le sont pas, pour que du bruit ne prenne jamais la
 * place d'un vrai client ; celles au piège rempli attendent le staff.
 */
export async function retryPendingAcks(admin: Admin, limit = 10): Promise<number> {
  if (!isMailConfigured()) return 0;
  const now = new Date().toISOString();
  const pending = (linked: boolean) => {
    const q = admin
      .from("order_withdrawals")
      .select("id")
      .is("ack_sent_at", null)
      .eq("suspect", false)
      .lt("ack_attempts", MAX_ACK_ATTEMPTS)
      .or(`ack_hold_until.is.null,ack_hold_until.lt.${now}`);
    return (linked ? q.neq("match", "none") : q.eq("match", "none")).order("received_at", { ascending: true });
  };

  const ids: string[] = [];
  for (const linked of [true, false]) {
    if (ids.length >= limit) break;
    const { data, error } = await pending(linked).limit(limit - ids.length);
    if (error) {
      console.error("[retractation] filet:", error.message);
      break;
    }
    ids.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
  }
  // En parallèle : chaque envoi peut attendre jusqu'à 15 s le fournisseur.
  const results = await Promise.all(ids.map((id) => sendAck(admin, id)));
  return results.filter((r) => r.sent).length;
}
