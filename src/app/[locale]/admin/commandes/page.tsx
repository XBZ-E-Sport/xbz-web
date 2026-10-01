import AdminForm from "@/components/AdminForm";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/adminguard";
import { formatEuros } from "@/lib/money";
import { orderNumber, type Order, type OrderStatus } from "@/lib/shop";
import { stripeDashboardUrl } from "@/lib/stripe";
import { markOrderShipped } from "./actions";

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
  const key: FilterKey = vue && vue in FILTERS ? (vue as FilterKey) : "a-expedier";

  const { data, error } = await admin
    .from("orders")
    .select("*")
    .in("status", [...FILTERS[key].statuses])
    .order("created_at", { ascending: key === "a-expedier" })
    .limit(200);

  if (error) return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  const orders = (data ?? []) as Order[];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filtrer les commandes" className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
          <Link
            key={k}
            href={`/admin/commandes?vue=${k}`}
            aria-current={k === key ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              k === key ? "bg-xbz-blue text-white" : "bg-white/5 text-neutral-300 hover:bg-white/10"
            }`}
          >
            {FILTERS[k].label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
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

                <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-200">
                  {o.items.map((i) => (
                    <li key={i.variant_id}>
                      <span className="font-bold">{i.quantity} ×</span> {i.name}
                      {i.size && <span className="font-bold"> — taille {i.size}</span>}
                      <span className="text-neutral-400"> · {formatEuros(i.unit_amount / 100, "fr")} pièce</span>
                    </li>
                  ))}
                  <li className="text-neutral-400">+ port {formatEuros(Number(o.shipping), "fr")}</li>
                </ul>

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
