import { requireStaff } from "@/lib/adminguard";
import { setOrderStatus } from "./actions";

export const metadata = { title: "Commandes — Back-office XBZ" };
export const dynamic = "force-dynamic";

const statutStyles: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  fulfilled: "bg-blue-500/15 text-blue-300",
  refunded: "bg-neutral-500/15 text-neutral-300",
};

const statutLabel: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  fulfilled: "Expédiée",
  refunded: "Remboursée",
};

type LineItem = { name: string | null; quantity: number | null; amount_cents: number | null };
type Address = Record<string, string | null> | null;
type Order = {
  id: string;
  status: string;
  amount_total: number | string;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Address;
  line_items: LineItem[] | null;
  created_at: string;
};

function euros(value: number | string, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
  }).format(Number(value));
}

function formatAddress(a: Address): string {
  if (!a) return "—";
  return [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.country]
    .filter(Boolean)
    .join(", ");
}

export default async function AdminCommandesPage() {
  // Garde DANS la page : layout et page sont rendus en parallèle par l'App
  // Router, une garde au seul layout laisserait la page lire la base.
  const { admin } = await requireStaff();

  const { data: orders, error } = await admin
    .from("orders")
    .select(
      "id, status, amount_total, currency, customer_email, customer_name, shipping_address, line_items, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  if (!orders?.length) return <p className="text-neutral-400">Aucune commande pour le moment.</p>;

  const list = orders as Order[];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-400">{list.length} commande(s)</p>

      {list.map((o) => (
        <div key={o.id} className="card-xbz p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-white">
                {o.customer_name || o.customer_email || "Client"}
              </p>
              <p className="text-sm text-neutral-400">
                {o.customer_email} · {new Date(o.created_at).toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display text-lg font-bold text-white">
                {euros(o.amount_total, o.currency)}
              </span>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  statutStyles[o.status] ?? "bg-white/10 text-neutral-300"
                }`}
              >
                {statutLabel[o.status] ?? o.status}
              </span>
            </div>
          </div>

          <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-300">
            {(o.line_items ?? []).map((li, i) => (
              <li key={i}>
                {li.quantity ?? 1} × {li.name ?? "Article"}
                {typeof li.amount_cents === "number" && (
                  <span className="text-neutral-500"> — {euros(li.amount_cents / 100, o.currency)}</span>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-2 text-sm text-neutral-400">
            <span className="font-semibold text-neutral-300">Livraison :</span>{" "}
            {formatAddress(o.shipping_address)}
          </p>

          {/* Une commande payée peut être marquée expédiée ; toute commande non
              remboursée peut l'être. 'paid' vient du webhook, jamais d'ici. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {o.status === "paid" && (
              <form action={setOrderStatus}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="statut" value="fulfilled" />
                <button className="rounded-lg bg-blue-500/15 px-3 py-1.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/25 hover:cursor-pointer">
                  📦 Marquer expédiée
                </button>
              </form>
            )}
            {o.status !== "refunded" && (
              <form action={setOrderStatus}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="statut" value="refunded" />
                <button className="rounded-lg bg-neutral-500/15 px-3 py-1.5 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-500/25 hover:cursor-pointer">
                  ↩️ Marquer remboursée
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
