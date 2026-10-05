import { getLocale } from "next-intl/server";

import AdminForm from "@/components/AdminForm";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/adminguard";
import { formatEuros } from "@/lib/money";
import { parisDay } from "@/lib/orders-export";
import { printText } from "@/lib/personalization";
import { localizedPath } from "@/lib/site";
import { CONFIRMATION_SINCE } from "@/lib/order-mail";
import { orderNumber, type Order, type OrderStatus } from "@/lib/shop";
import { stripeDashboardUrl } from "@/lib/stripe";
import type { WithdrawalRow } from "@/lib/withdrawal";
import { markOrderShipped, resendOrderConfirmation, validateOrderPrints } from "./actions";
import PersonalizedNotice, { printedItems } from "./PersonalizedNotice";
import Withdrawals, { type LinkedOrder } from "./Withdrawals";

export const metadata = { title: "Commandes — Back-office XBZ" };
export const dynamic = "force-dynamic";

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "Paiement en cours", cls: "bg-white/10 text-neutral-300" },
  paid: { label: "Payée — à expédier", cls: "bg-xbz-cyan/15 text-xbz-cyan" },
  fulfilled: { label: "Expédiée", cls: "bg-emerald-500/15 text-emerald-300" },
  cancelled: { label: "Abandonnée", cls: "bg-white/5 text-neutral-400" },
  refunded: { label: "Remboursée", cls: "bg-red-500/15 text-red-300" },
};

// Onglets : « à expédier » par défaut — c'est la liste dont le staff a besoin.
const FILTERS = {
  "a-expedier": { label: "À expédier", statuses: ["paid"] },
  traitees: { label: "Expédiées & remboursées", statuses: ["fulfilled", "refunded"] },
  "en-cours": { label: "Paiements en cours", statuses: ["pending"] },
  abandonnees: { label: "Abandonnées", statuses: ["cancelled"] },
} as const satisfies Record<string, { label: string; statuses: OrderStatus[] }>;
type FilterKey = keyof typeof FILTERS;

/** Suivi de la confirmation connu : migration passée ET commande payée depuis la mise en service. */
const confirmationTracked = (o: Order) =>
  "confirmation_sent_at" in o && o.paid_at !== null && Date.parse(o.paid_at) >= Date.parse(CONFIRMATION_SINCE);

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function formatAddress(a: Order["shipping_address"]): string {
  if (!a) return "—";
  return [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country]
    .filter(Boolean)
    .join(", ");
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  // Garde DANS la page (layout et page sont rendus en parallèle).
  const { admin } = await requireStaff();
  const { vue } = await searchParams;
  const today = parisDay(new Date());
  const exportAction = localizedPath("/admin/commandes/export", await getLocale());
  // Onglet à part : les déclarations faites avec « Renoncer au contrat ici ».
  const showWithdrawals = vue === "retractations";
  const key: FilterKey = vue && vue in FILTERS ? (vue as FilterKey) : "a-expedier";

  let orders: Order[] = [];
  if (!showWithdrawals) {
    const { data, error } = await admin
      .from("orders")
      .select("*")
      .in("status", [...FILTERS[key].statuses])
      .order("created_at", { ascending: key === "a-expedier" })
      .limit(200);
    if (error) return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
    orders = (data ?? []) as Order[];
  }

  // Rétractations à traiter (pastille de l'onglet). Table absente = migration pas
  // encore passée : le code ne casse pas, l'onglet l'explique.
  // Lecture réelle (pas un comptage « HEAD », qui ne distingue pas une table absente d'une
  // table vide) : 42P01 / PGRST205 = migration pas passée ; toute autre erreur est montrée.
  const pending = await admin.from("order_withdrawals").select("id").is("processed_at", null).limit(100);
  const tableMissing = pending.error?.code === "42P01" || pending.error?.code === "PGRST205";
  const withdrawalsError = pending.error && !tableMissing ? pending.error.message : null;
  const pendingWithdrawals = pending.error ? 0 : (pending.data?.length ?? 0);

  let withdrawalRows: WithdrawalRow[] = [];
  let linkedOrders = new Map<string, LinkedOrder>();
  const withdrawalsByOrder = new Map<string, WithdrawalRow>();
  if (!pending.error) {
    if (showWithdrawals) {
      // À traiter d'abord (`processed_at` nul en tête), les plus récentes en premier dans chaque
      // groupe — trié par la base AVANT la limite : une déclaration en attente ne tombe jamais
      // hors de la page parce que 200 plus récentes ont déjà été traitées.
      const { data } = await admin
        .from("order_withdrawals")
        .select("*")
        .order("processed_at", { ascending: false, nullsFirst: true })
        .order("received_at", { ascending: false })
        .limit(200);
      withdrawalRows = (data ?? []) as WithdrawalRow[];
      const ids = [...new Set(withdrawalRows.flatMap((w) => (w.order_id ? [w.order_id] : [])))];
      if (ids.length) {
        const { data: linked } = await admin
          .from("orders")
          .select("id, status, stripe_payment_intent, amount_total, items")
          .in("id", ids);
        linkedOrders = new Map(((linked ?? []) as LinkedOrder[]).map((o) => [o.id, o]));
      }
    } else if (orders.length) {
      // Pastille « rétractation reçue » sur les commandes concernées.
      const { data } = await admin
        .from("order_withdrawals")
        .select("*")
        .in("order_id", orders.map((o) => o.id))
        .order("received_at", { ascending: false });
      for (const w of (data ?? []) as WithdrawalRow[]) {
        if (w.order_id && !withdrawalsByOrder.has(w.order_id)) withdrawalsByOrder.set(w.order_id, w);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <details className="card-xbz p-5">
        <summary className="cursor-pointer text-sm font-semibold text-xbz-cyan">Export comptable (CSV)</summary>
        {/* Téléchargement : un simple GET, le navigateur enregistre le fichier
            sans quitter la page. Route : export/route.ts (réservée au staff). */}
        <form method="get" action={exportAction} className="mt-4 flex flex-wrap items-end gap-4 text-sm text-neutral-200">
          <div>
            <label htmlFor="export-du" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Du
            </label>
            <input
              id="export-du"
              name="du"
              type="date"
              required
              defaultValue={`${today.slice(0, 8)}01`}
              max={today}
              className="rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label htmlFor="export-au" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Au (inclus)
            </label>
            <input
              id="export-au"
              name="au"
              type="date"
              required
              defaultValue={today}
              max={today}
              className="rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label htmlFor="export-detail" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Détail
            </label>
            <select
              id="export-detail"
              name="detail"
              defaultValue="commandes"
              className="rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="commandes">Une ligne par commande</option>
              <option value="articles">Une ligne par article (et par port)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="export-perso" name="perso" type="checkbox" value="1" className="h-4 w-4" />
            <label htmlFor="export-perso">Inclure nom, e-mail et adresse (par commande)</label>
          </div>
          <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
            Télécharger le CSV
          </button>
        </form>
        <p className="mt-3 text-xs text-neutral-400">
          Commandes payées (expédiées et remboursées comprises), classées par date de paiement. Un remboursement
          figure sur la ligne de la commande remboursée, avec sa date. Le fichier s’ouvre directement dans Excel. Nom,
          e-mail et adresse sont des données personnelles : à ne cocher que si nécessaire.
        </p>
      </details>

      <nav aria-label="Filtrer les commandes" className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
          <Link
            key={k}
            href={`/admin/commandes?vue=${k}`}
            aria-current={k === key && !showWithdrawals ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              k === key && !showWithdrawals ? "bg-xbz-blue text-white" : "bg-white/5 text-neutral-300 hover:bg-white/10"
            }`}
          >
            {FILTERS[k].label}
          </Link>
        ))}
        <Link
          href="/admin/commandes?vue=retractations"
          aria-current={showWithdrawals ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            showWithdrawals
              ? "bg-xbz-blue text-white"
              : pendingWithdrawals > 0
                ? "bg-red-500/20 text-red-200 hover:bg-red-500/30"
                : "bg-white/5 text-neutral-300 hover:bg-white/10"
          }`}
        >
          ↩️ Rétractations{pendingWithdrawals > 0 ? ` (${pendingWithdrawals})` : ""}
        </Link>
      </nav>

      {showWithdrawals ? (
        <Withdrawals rows={withdrawalRows} orders={linkedOrders} tableMissing={tableMissing} loadError={withdrawalsError} />
      ) : orders.length === 0 ? (
        <p className="text-neutral-400">Aucune commande ici pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((o) => {
            const st = STATUS[o.status] ?? STATUS.pending;
            return (
              <li key={o.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-white">{orderNumber(o.id)}</p>
                    <p className="text-sm text-neutral-400">
                      {dateTime.format(new Date(o.paid_at ?? o.created_at))}
                      {o.status === "pending" && o.expires_at && ` · réservée jusqu’à ${dateTime.format(new Date(o.expires_at))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg font-bold text-white">
                      {formatEuros(Number(o.amount_total ?? Number(o.subtotal) + Number(o.shipping)), "fr")}
                    </span>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                </div>

                {o.note && (
                  <p className="mt-3 rounded-lg border border-xbz-cyan/30 bg-xbz-cyan/10 px-3 py-2 text-sm font-semibold text-xbz-cyan">
                    ⚠️ {o.note}
                  </p>
                )}

                {withdrawalsByOrder.has(o.id) && (
                  <p className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
                    ↩️ Une rétractation a été déclarée le{" "}
                    {dateTime.format(new Date((withdrawalsByOrder.get(o.id) as WithdrawalRow).received_at))}
                    {(withdrawalsByOrder.get(o.id) as WithdrawalRow).processed_at
                      ? " (traitée)"
                      : " — non vérifiée : contrôle-la avant d’expédier ou de rembourser"}
                    .{" "}

                    <Link href="/admin/commandes?vue=retractations" className="underline">
                      Voir la rétractation
                    </Link>
                  </p>
                )}
                {withdrawalsByOrder.has(o.id) && <PersonalizedNotice items={o.items} />}

                <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-200">
                  {o.items.map((i, n) => (
                    <li key={`${i.variant_id}-${n}`}>
                      <span className="font-bold">{i.quantity} ×</span> {i.name}
                      {i.size && <span className="font-bold"> — taille {i.size}</span>}
                      <span className="text-neutral-400"> · {formatEuros(i.unit_amount / 100, "fr")} pièce</span>
                      {i.print && (
                        <span className="mt-1 block rounded-md border border-xbz-cyan/30 bg-xbz-cyan/10 px-2 py-1 font-semibold text-xbz-cyan">
                          ✏️ À personnaliser : {printText(i.print, "n°")}{i.print.validated_at ? " ✅" : o.status === "paid" ? " (à valider)" : ""}
                          {i.print.extra > 0 && (
                            <span className="font-normal text-neutral-300">
                              {" "}
                              (supplément {formatEuros(i.print.extra / 100, "fr")} compris)
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                  <li className="text-neutral-400">+ port {formatEuros(Number(o.shipping), "fr")}</li>
                </ul>

                {printedItems(o.items).length > 0 && (o.status === "paid" || printedItems(o.items).every((i) => i.print?.validated_at)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-xbz-cyan/30 bg-xbz-cyan/10 px-3 py-2 text-sm">
                    {printedItems(o.items).every((i) => i.print?.validated_at) ? (
                      <span className="font-semibold text-emerald-300">
                        ✅ Textes à imprimer validés le{" "}
                        {dateTime.format(new Date(printedItems(o.items).map((i) => i.print?.validated_at as string).sort().pop() as string))}
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold text-xbz-cyan">
                          ✏️ Textes à valider avant l’envoi à l’atelier : orthographe, texte injurieux, marque ou droits
                          de tiers. L’expédition est bloquée tant qu’ils ne sont pas validés.
                        </span>
                        {o.status === "paid" && (
                          <AdminForm action={validateOrderPrints} loadingMessage="Validation…" successMessage="Textes validés">
                            <input type="hidden" name="id" value={o.id} />
                            <button className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 hover:cursor-pointer">
                              ✅ Textes relus et validés
                            </button>
                          </AdminForm>
                        )}
                      </>
                    )}
                  </div>
                )}

                {(o.customer_name || o.customer_email || o.shipping_address) && (
                  <div className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-neutral-300">
                    <p className="font-semibold text-white">{o.customer_name ?? "—"}</p>
                    {o.customer_email && <p>{o.customer_email}</p>}
                    <p>{formatAddress(o.shipping_address)}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {o.status === "paid" && (
                    <AdminForm action={markOrderShipped} loadingMessage="Mise à jour…" successMessage="Commande expédiée">
                      <input type="hidden" name="id" value={o.id} />
                      <button className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 hover:cursor-pointer">
                        📦 Marquer expédiée
                      </button>
                    </AdminForm>
                  )}
                  {(o.status === "paid" || o.status === "fulfilled") && o.customer_email && (
                    <>
                      {confirmationTracked(o) && (
                        <span className={`text-sm ${o.confirmation_error && !o.confirmation_sent_at ? "font-semibold text-red-300" : "text-neutral-400"}`}>
                          {o.confirmation_sent_at
                            ? `✉️ Confirmation envoyée le ${dateTime.format(new Date(o.confirmation_sent_at))}`
                            : o.confirmation_error
                              ? `⚠️ Confirmation non envoyée (${o.confirmation_error})`
                              : "✉️ Confirmation pas encore envoyée"}
                        </span>
                      )}
                      <AdminForm action={resendOrderConfirmation} loadingMessage="Envoi…" successMessage="Confirmation envoyée">
                        <input type="hidden" name="id" value={o.id} />
                        <button className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-neutral-200 transition hover:bg-white/15 hover:cursor-pointer">
                          {o.confirmation_sent_at ? "Renvoyer" : "Envoyer"} la confirmation
                        </button>
                      </AdminForm>
                    </>
                  )}
                  {o.stripe_payment_intent && (
                    <a
                      href={stripeDashboardUrl(o.stripe_payment_intent)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-xbz-cyan hover:underline"
                    >
                      Voir le paiement dans Stripe (remboursement)
                      <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
