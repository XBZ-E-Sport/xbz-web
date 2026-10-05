// E-mail de confirmation de commande : logique PURE (aucun accès à la base ni au réseau).
//
// Il part après le paiement, en plus du reçu de Stripe. Il confirme le contrat sur
// support durable (article L.221-13 du Code de la consommation) et reprend ce que le
// client doit pouvoir conserver : ce qu'il a commandé (texte imprimé compris), les
// montants, le délai de livraison, le droit de rétractation et la manière de l'exercer
// (fonction en ligne, formulaire type des CGV), l'exclusion pour les articles
// personnalisés, les garanties légales.

import { formatEuros } from "@/lib/money";
import { printText, type Print } from "@/lib/personalization";
import { escapeHtml, type Translate } from "@/lib/withdrawal";

export type ConfirmationItem = {
  name: string;
  size: string;
  quantity: number;
  /** Prix unitaire PAYÉ, en centimes (supplément de personnalisation compris). */
  unit_amount: number;
  print?: Print & { extra?: number };
};

export type ConfirmationInput = {
  locale: string;
  name: string | null;
  orderNumber: string;
  items: ConfirmationItem[];
  /** Frais de port, en euros. */
  shipping: number;
  /** Total encaissé, en euros. */
  total: number;
  deliveryDays: number;
  association: string;
  address: string;
  contactEmail: string;
  /** Conditions générales de vente. */
  termsUrl: string;
  /** Fonction « Renoncer au contrat ici ». */
  withdrawalUrl: string;
};

export type ConfirmationMail = { subject: string; text: string; html: string };

/** « Maillot officiel (M) », sans parenthèses pour une taille unique. */
function itemLabel(t: Translate, i: ConfirmationItem): string {
  return i.size ? t("itemSized", { name: i.name, size: i.size }) : i.name;
}

export function buildOrderConfirmation(t: Translate, input: ConfirmationInput): ConfirmationMail {
  const money = (euros: number) => formatEuros(euros, input.locale);
  const hasPrint = input.items.some((i) => i.print);

  const lines = input.items.map((i) => {
    const base = t("itemLine", {
      quantity: i.quantity,
      label: itemLabel(t, i),
      total: money((i.quantity * i.unit_amount) / 100),
    });
    const print = i.print ? t("itemPrint", { text: printText(i.print, t("printNumber")) }) : null;
    return { base, print };
  });

  const greeting = input.name ? t("greeting", { name: input.name }) : t("greetingAnonymous");
  const intro = t("intro", { number: input.orderNumber });
  const totals = [t("shippingLine", { amount: money(input.shipping) }), t("totalLine", { amount: money(input.total) })];
  const after = [
    t("delivery", { days: input.deliveryDays }),
    t("withdrawal", { url: input.withdrawalUrl }),
    ...(hasPrint ? [t("withdrawalPrint")] : []),
    t("guarantees"),
    t("terms", { url: input.termsUrl }),
    t("contact", { email: input.contactEmail }),
  ];
  const signature = t("signature", { association: input.association, address: input.address, email: input.contactEmail });

  const text = [
    greeting,
    intro,
    [t("itemsTitle"), ...lines.map((l) => (l.print ? `— ${l.base}\n    ${l.print}` : `— ${l.base}`)), ...totals.map((x) => `— ${x}`)].join("\n"),
    ...after,
    signature,
  ].join("\n\n");

  // Les liens sont rendus cliquables dans le HTML ; tout le reste est échappé.
  const linkify = (s: string) => {
    let out = escapeHtml(s);
    for (const url of [input.withdrawalUrl, input.termsUrl]) {
      const safe = escapeHtml(url);
      out = out.split(safe).join(`<a href="${safe}">${safe}</a>`);
    }
    return out;
  };
  const p = (s: string) => `<p style="margin:0 0 14px">${linkify(s)}</p>`;

  const html = `<!doctype html>
<html lang="${input.locale === "en" ? "en" : "fr"}">
<body style="margin:0;padding:24px;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1f;font-size:15px;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px">
${p(greeting)}
${p(intro)}
<p style="margin:0 0 6px"><strong>${escapeHtml(t("itemsTitle"))}</strong></p>
<ul style="margin:0 0 14px;padding-left:20px">
${lines
  .map(
    (l) =>
      `<li>${escapeHtml(l.base)}${l.print ? `<br><span style="color:#444">${escapeHtml(l.print)}</span>` : ""}</li>`,
  )
  .join("\n")}
${totals.map((x) => `<li><strong>${escapeHtml(x)}</strong></li>`).join("\n")}
</ul>
${after.map(p).join("\n")}
<p style="margin:20px 0 0;color:#6b6b76;font-size:13px">${escapeHtml(signature)}</p>
</div>
</body>
</html>`;

  return { subject: t("subject", { number: input.orderNumber }), text, html };
}
