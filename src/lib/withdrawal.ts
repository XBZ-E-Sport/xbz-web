// Rétractation en ligne : logique PURE (rapprochement de la commande, accusé de
// réception). Rien ici ne touche la base ni le réseau : tout se teste à plat.
//
// Cadre : directive (UE) 2023/2673 (article 11 bis de la directive 2011/83) et
// article L.221-21 du Code de la consommation, depuis le 19 juin 2026.
//  - la fonction s'appelle « Renoncer au contrat ici » ;
//  - le client indique son nom, de quoi identifier le contrat et l'adresse où
//    recevoir l'accusé ;
//  - il CONFIRME (second bouton, « Confirmer la rétractation ») ;
//  - l'accusé de réception part sans délai, sur support durable (e-mail), avec
//    le contenu de la déclaration ET la date et l'heure de son envoi.

import { orderNumber } from "@/lib/shop";

/** Fonction de traduction (`getTranslations` ou `createTranslator`). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type MatchKind = "exact" | "single" | "ambiguous" | "none";

/** Ligne de `order_withdrawals` (voir supabase/migration_retractation_05102026.sql). */
export type WithdrawalRow = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  match: MatchKind;
  customer_name: string;
  customer_email: string;
  details: string | null;
  locale: string;
  received_at: string;
  ack_sent_at: string | null;
  ack_attempts: number;
  ack_error: string | null;
  processed_at: string | null;
};

export type Matched = {
  /** Commande rapprochée, ou `null` si le staff doit trancher. */
  orderId: string | null;
  match: MatchKind;
  /** Numéro saisi par le client, normalisé (`XBZ-1A2B3C4D`), ou `null`. */
  orderNumber: string | null;
};

/**
 * « xbz-1a2b 3c4d », « XBZ1A2B3C4D », « 1a2b3c4d » → `XBZ-1A2B3C4D`.
 * `null` si ce n'est pas un numéro de commande (huit chiffres hexadécimaux).
 */
export function normalizeOrderNumber(raw: string): string | null {
  const compact = raw.replace(/[\s_-]+/g, "").toUpperCase();
  const m = /^(?:XBZ)?([0-9A-F]{8})$/.exec(compact);
  return m ? `XBZ-${m[1]}` : null;
}

/**
 * Commande visée par la déclaration, parmi les commandes PAYÉES de l'e-mail
 * saisi (`orders`).
 *
 *  - un numéro de commande reconnu l'emporte (`exact`) ;
 *  - sinon, une seule commande payée pour cet e-mail : c'est elle (`single`) ;
 *  - plusieurs : le staff tranche (`ambiguous`), sans jamais deviner ;
 *  - aucune : `none`.
 *
 * Dans tous les cas la déclaration est ENREGISTRÉE et ACQUITTÉE : un rapprochement
 * raté ne rend pas la rétractation invalide, il demande seulement un coup d'œil.
 */
export function matchOrder(orders: { id: string }[], typed: string | null): Matched {
  const number = typed ? normalizeOrderNumber(typed) : null;
  if (number) {
    const exact = orders.find((o) => orderNumber(o.id) === number);
    if (exact) return { orderId: exact.id, match: "exact", orderNumber: number };
  }
  if (orders.length === 1) return { orderId: orders[0].id, match: "single", orderNumber: number };
  return { orderId: null, match: orders.length > 1 ? "ambiguous" : "none", orderNumber: number };
}

/** Motif `ilike` qui ne tolère aucun joker : « a_b@x.fr » ne doit pas viser « aXb@x.fr ». */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** « lundi 5 octobre 2026 à 01:11:23 UTC+2 » : date ET heure, fuseau de Paris. */
export function formatReceivedAt(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

export type AckInput = {
  locale: string;
  name: string;
  email: string;
  /** Numéro saisi par le client (normalisé) ou, à défaut, celui de la commande rapprochée. */
  orderNumber: string | null;
  details: string | null;
  receivedAt: Date;
  returnAddress: string;
  association: string;
  address: string;
  contactEmail: string;
  /** Lien vers l'article « Droit de rétractation » des CGV. */
  termsUrl: string;
};

export type AckMail = { subject: string; text: string; html: string };

/**
 * Accusé de réception : l'objet est FIXE (jamais de texte du client dans un en-tête),
 * le corps reprend la déclaration, la date et l'heure. Texte brut ET HTML, tirés des
 * mêmes phrases (`withdrawalMail` dans messages/*.json) ; tout ce que le client a
 * saisi est échappé dans le HTML.
 */
export function buildAck(t: Translate, input: AckInput): AckMail {
  const when = formatReceivedAt(input.receivedAt, input.locale);
  const order = input.orderNumber ?? t("orderNone");

  const fields: [string, string][] = [
    [t("fieldName"), input.name],
    [t("fieldEmail"), input.email],
    [t("fieldOrder"), order],
  ];
  if (input.details) fields.push([t("fieldDetails"), input.details]);

  const paragraphs = [
    t("greeting", { name: input.name }),
    t("intro", { when }),
  ];
  const after = [
    t("nextSteps", { returnAddress: input.returnAddress }),
    t("refund"),
    t("keep"),
    t("terms", { url: input.termsUrl }),
  ];
  const signature = t("signature", {
    association: input.association,
    address: input.address,
    email: input.contactEmail,
  });

  const text = [
    ...paragraphs,
    [t("contentTitle"), ...fields.map(([k, v]) => `— ${k} ${v}`)].join("\n"),
    ...after,
    signature,
  ].join("\n\n");

  const p = (s: string) => `<p style="margin:0 0 14px">${escapeHtml(s)}</p>`;
  const html = `<!doctype html>
<html lang="${input.locale === "en" ? "en" : "fr"}">
<body style="margin:0;padding:24px;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1f;font-size:15px;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px">
${paragraphs.map(p).join("\n")}
<p style="margin:0 0 6px"><strong>${escapeHtml(t("contentTitle"))}</strong></p>
<ul style="margin:0 0 14px;padding-left:20px">
${fields.map(([k, v]) => `<li>${escapeHtml(k)} <strong>${escapeHtml(v)}</strong></li>`).join("\n")}
</ul>
${after
  .map((s) => (s.includes(input.termsUrl) ? `<p style="margin:0 0 14px">${escapeHtml(s).replace(escapeHtml(input.termsUrl), `<a href="${escapeHtml(input.termsUrl)}">${escapeHtml(input.termsUrl)}</a>`)}</p>` : p(s)))
  .join("\n")}
<p style="margin:20px 0 0;color:#6b6b76;font-size:13px">${escapeHtml(signature)}</p>
</div>
</body>
</html>`;

  return { subject: t("subject"), text, html };
}
