// Export CSV des commandes pour la comptabilité. Module PUR (pas de base, pas
// de réseau) : tout ce qui décide du contenu et du format du fichier vit ici,
// testable sans serveur. La route (admin/commandes/export/route.ts) ne fait
// que vérifier l'accès, lire les commandes et renvoyer ce que ce module produit.
//
// Trois exigences, dans l'ordre :
//  1. SÉCURITÉ — un nom, une adresse ou un nom de produit est une saisie libre :
//     « =HYPERLINK(…) » ou « =cmd|… » dans une cellule devient une FORMULE à
//     l'ouverture dans Excel (injection CSV). Tout texte est neutralisé.
//  2. EXCEL FRANÇAIS — séparateur « ; », virgule décimale, dates jj/mm/aaaa,
//     UTF-8 avec BOM (sans lui, « Hélène » devient « HÃ©lÃ¨ne »), fins de
//     ligne CRLF. Un double-clic sur le fichier doit suffire.
//  3. COMPTABILITÉ — une ligne par commande payée (ou par article), montants
//     exacts au centime, date et montant des remboursements, référence Stripe
//     pour le rapprochement bancaire.
//
// Données personnelles (RGPD) : nom, e-mail et adresse ne sortent que sur
// demande explicite (`perso=1`). Une comptabilité n'en a pas besoin.

import { printText } from "@/lib/personalization";
import { orderNumber, type Order, type OrderStatus } from "@/lib/shop";

export type ExportDetail = "commandes" | "articles";

export type ExportParams = {
  /** Début inclus (minuit, heure de Paris). */
  from: Date;
  /** Fin EXCLUE (minuit du lendemain du dernier jour, heure de Paris). */
  to: Date;
  /** Jours demandés, `AAAA-MM-JJ`, pour le nom du fichier. */
  fromDay: string;
  toDay: string;
  detail: ExportDetail;
  personal: boolean;
};

/** Statuts qui ont donné lieu à un encaissement : les seuls exportés. */
export const EXPORT_STATUSES = ["paid", "fulfilled", "refunded"] as const satisfies readonly OrderStatus[];

/** Période maximale d'un export (jours). */
export const MAX_EXPORT_DAYS = 366;
/** Garde-fou de volume : au-delà, on demande de réduire la période. */
export const MAX_EXPORT_ROWS = 10_000;

const TIME_ZONE = "Europe/Paris";

// --- Période ----------------------------------------------------------------

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-JJ` d'un instant, jour calendaire de Paris. */
export function parisDay(date: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** Vrai pour un jour réel du calendrier (le 31 avril n'existe pas). */
function isRealDay(day: string): boolean {
  const m = DAY.exec(day);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Décalage de Paris par rapport à UTC à un instant donné, en millisecondes. */
function parisOffsetMs(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** L'instant où il est minuit à Paris le jour `day` (changements d'heure compris). */
export function parisMidnight(day: string): Date {
  const m = DAY.exec(day)!;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Les changements d'heure ont lieu la nuit, à 2 h ou 3 h : le décalage à
  // minuit UTC est celui de minuit à Paris, sauf à rester prudent — on relit
  // le décalage à l'instant obtenu.
  const first = utcMidnight - parisOffsetMs(new Date(utcMidnight));
  return new Date(utcMidnight - parisOffsetMs(new Date(first)));
}

function nextDay(day: string): string {
  const m = DAY.exec(day)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10);
}

function daysBetween(fromDay: string, toDay: string): number {
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  return Math.round((t(toDay) - t(fromDay)) / 86_400_000) + 1;
}

/**
 * Lit et valide les paramètres de l'URL. Sans dates : du 1er du mois à
 * aujourd'hui (Paris). Une erreur est un message pour le staff.
 */
export function parseExportParams(
  search: URLSearchParams,
  now: Date = new Date(),
): { ok: true; params: ExportParams } | { ok: false; error: string } {
  const today = parisDay(now);
  const fromDay = search.get("du")?.trim() || `${today.slice(0, 8)}01`;
  const toDay = search.get("au")?.trim() || today;
  if (!isRealDay(fromDay) || !isRealDay(toDay)) {
    return { ok: false, error: "Dates invalides : utilise le format AAAA-MM-JJ avec des jours qui existent." };
  }
  if (fromDay > toDay) return { ok: false, error: "La date de début est après la date de fin." };
  if (daysBetween(fromDay, toDay) > MAX_EXPORT_DAYS) {
    return { ok: false, error: `Période trop longue : ${MAX_EXPORT_DAYS} jours au plus par export.` };
  }
  const detailRaw = search.get("detail") ?? "commandes";
  if (detailRaw !== "commandes" && detailRaw !== "articles") {
    return { ok: false, error: "Détail inconnu : « commandes » ou « articles »." };
  }
  return {
    ok: true,
    params: {
      from: parisMidnight(fromDay),
      to: parisMidnight(nextDay(toDay)),
      fromDay,
      toDay,
      detail: detailRaw,
      personal: search.get("perso") === "1",
    },
  };
}

/** Nom du fichier téléchargé : sûr (ASCII, sans espace) et parlant. */
export function exportFilename(p: Pick<ExportParams, "fromDay" | "toDay" | "detail">): string {
  return `xbz-${p.detail}_${p.fromDay}_${p.toDay}.csv`;
}

// --- Cellules ---------------------------------------------------------------

/**
 * Texte libre → cellule CSV sûre.
 *
 *  - une cellule qui COMMENCE par `=`, `+`, `-` ou `@` est lue comme une
 *    formule par Excel et LibreOffice : on la fait précéder d'une apostrophe
 *    (recommandation OWASP) ;
 *  - tabulations, retours à la ligne et autres caractères de contrôle sont
 *    aplatis en espaces (une tabulation ou un CR en tête déclenche la même
 *    chose, et un retour à la ligne casse les lecteurs simples) ;
 *  - toujours entre guillemets, guillemets doublés.
 */
export function csvText(value: string | null | undefined): string {
  const flat = (value ?? "").replace(/[\u0000-\u001f\u007f\u0080-\u009f\u2028\u2029]+/g, " ").trim();
  const safe = /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Montant en euros : « 1234,50 », virgule décimale, deux décimales, sans séparateur de milliers. */
export function csvEuros(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  // Centimes : `1.005 * 100` vaut 100.49999999999999 en flottant. On élimine ce
  // bruit (15 chiffres significatifs) avant d'arrondir, sinon un montant peut
  // perdre un centime.
  const cents = Math.round(Number((n * 100).toPrecision(15)));
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Entier brut (quantités). */
const csvInt = (n: number): string => String(Math.trunc(n));

/** Date et heure de Paris : « 03/10/2026 14:05 ». Vide si absente ou illisible. */
export function csvDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Paiement en cours",
  paid: "Payée",
  fulfilled: "Expédiée",
  cancelled: "Abandonnée",
  refunded: "Remboursée",
};

// --- Lignes -----------------------------------------------------------------

const euros = (v: number | string | null | undefined) => Number(v ?? 0);

/** Montants d'une commande, en euros. Le montant ENCAISSÉ (relu chez Stripe) fait foi. */
export function orderAmounts(o: Order) {
  const subtotal = euros(o.subtotal);
  const shipping = euros(o.shipping);
  const total = o.amount_total === null || o.amount_total === undefined ? subtotal + shipping : euros(o.amount_total);
  // Montant remboursé : celui enregistré par le webhook ; avant la migration,
  // une commande « remboursée » l'a été en totalité (c'est ce que dit ce statut).
  const refunded =
    o.refunded_amount !== null && o.refunded_amount !== undefined
      ? euros(o.refunded_amount)
      : o.status === "refunded"
        ? total
        : 0;
  return { subtotal, shipping, total, refunded, net: total - refunded };
}

const itemsOf = (o: Order) => (Array.isArray(o.items) ? o.items : []);

/** « personnalisé : MARTIN · n° 10 », ou vide : ce que l'atelier doit imprimer. */
const printOf = (i: Order["items"][number]) => (i.print ? `personnalisé : ${printText(i.print, "n°")}` : "");

const addressOf = (o: Order) => o.shipping_address ?? {};

/** En-têtes, selon le détail et les données personnelles demandées. */
export function exportHeaders({ detail, personal }: Pick<ExportParams, "detail" | "personal">): string[] {
  if (detail === "articles") {
    return [
      "N° commande",
      "Date de paiement",
      "Statut",
      "Type de ligne",
      "Désignation",
      "Taille",
      "Quantité",
      "Prix unitaire (€)",
      "Total ligne (€)",
      "Personnalisation",
    ];
  }
  return [
    "N° commande",
    "Date de paiement",
    "Statut",
    "Articles",
    "Quantité totale",
    "Sous-total articles (€)",
    "Frais de port (€)",
    "Total encaissé (€)",
    "Montant remboursé (€)",
    "Net encaissé (€)",
    "Devise",
    "Date d'expédition",
    "Date de remboursement",
    "Pays de livraison",
    "Réf. paiement Stripe",
    ...(personal ? ["Nom", "E-mail", "Adresse", "Complément d'adresse", "Code postal", "Ville", "Région"] : []),
  ];
}

/** Cellules déjà encodées (texte entre guillemets, nombres au format français). */
export function exportRows(orders: Order[], opts: Pick<ExportParams, "detail" | "personal">): string[][] {
  return opts.detail === "articles" ? orders.flatMap(articleRows) : orders.map((o) => orderRow(o, opts.personal));
}

function orderRow(o: Order, personal: boolean): string[] {
  const a = orderAmounts(o);
  const items = itemsOf(o);
  const articles = items
    .map((i) => `${i.quantity} × ${i.name}${i.size ? ` (${i.size})` : ""}${i.print ? ` [${printOf(i)}]` : ""}`)
    .join(" ; ");
  const address = addressOf(o);
  return [
    csvText(orderNumber(o.id)),
    csvDateTime(o.paid_at),
    csvText(STATUS_LABEL[o.status] ?? o.status),
    csvText(articles),
    csvInt(items.reduce((n, i) => n + Number(i.quantity || 0), 0)),
    csvEuros(a.subtotal),
    csvEuros(a.shipping),
    csvEuros(a.total),
    csvEuros(a.refunded),
    csvEuros(a.net),
    csvText((o.currency || "eur").toUpperCase()),
    csvDateTime(o.fulfilled_at),
    csvDateTime(o.refunded_at),
    csvText(address.country),
    csvText(o.stripe_payment_intent),
    ...(personal
      ? [
          csvText(o.customer_name),
          csvText(o.customer_email),
          csvText(address.line1),
          csvText(address.line2),
          csvText(address.postal_code),
          csvText(address.city),
          csvText(address.state),
        ]
      : []),
  ];
}

/** Une ligne par article, puis une ligne de port : la somme retombe sur le total encaissé. */
function articleRows(o: Order): string[][] {
  const head = [csvText(orderNumber(o.id)), csvDateTime(o.paid_at), csvText(STATUS_LABEL[o.status] ?? o.status)];
  const lines = itemsOf(o).map((i) => [
    ...head,
    csvText("Article"),
    csvText(i.name),
    csvText(i.size),
    csvInt(i.quantity),
    csvEuros(i.unit_amount / 100),
    csvEuros((i.quantity * i.unit_amount) / 100),
    csvText(printOf(i)),
  ]);
  const shipping = euros(o.shipping);
  if (shipping > 0) {
    lines.push([
      ...head,
      csvText("Port"),
      csvText("Frais de port"),
      csvText(""),
      csvInt(1),
      csvEuros(shipping),
      csvEuros(shipping),
      csvText(""),
    ]);
  }
  return lines;
}

/**
 * Le fichier : BOM UTF-8 (Excel y reconnaît l'encodage), séparateur « ; »,
 * lignes séparées par CRLF, fin de fichier comprise.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  return `\uFEFF${[headers, ...rows].map((r) => r.join(";")).join("\r\n")}\r\n`;
}
