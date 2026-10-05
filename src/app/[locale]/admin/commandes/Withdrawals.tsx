import AdminForm from "@/components/AdminForm";
import ConfirmButton from "@/components/ConfirmButton";
import { formatEuros } from "@/lib/money";
import { orderNumber } from "@/lib/shop";
import { stripeDashboardUrl } from "@/lib/stripe";
import type { MatchKind, WithdrawalRow } from "@/lib/withdrawal";
import { deleteWithdrawal, linkWithdrawalToOrder, resendWithdrawalAck, setWithdrawalProcessed } from "./actions";

// Onglet « Rétractations » du back-office : les déclarations faites avec la fonction
// « Renoncer au contrat ici », à traiter une par une. Composant SERVEUR : les données
// arrivent de la page (qui porte la garde `requireStaff`).

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Paris" });

/** Ce que la commande rapprochée dit au staff. */
const MATCH_HINT: Record<MatchKind, string> = {
  exact: "Rapprochée : numéro de commande reconnu.",
  single: "Rapprochée d’après l’e-mail seul (la déclaration n’est pas authentifiée) : à confirmer avec le client si besoin.",
  ambiguous: "Non rapprochée : plusieurs commandes payées pour cet e-mail. Choisis laquelle ci-dessous.",
  mismatch: "Non rapprochée : le numéro saisi ne correspond à aucune commande payée de cet e-mail (autre adresse ? faute de frappe ?). Vérifie avant de rattacher.",
  none: "Non rapprochée : aucune commande payée pour cet e-mail. Vérifie l’orthographe ou une autre adresse.",
};

export type LinkedOrder = { id: string; status: string; stripe_payment_intent: string | null; amount_total: number | string | null };

const btn =
  "rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:cursor-pointer";

export default function Withdrawals({
  rows,
  orders,
  tableMissing,
  loadError,
}: {
  rows: WithdrawalRow[];
  orders: Map<string, LinkedOrder>;
  tableMissing: boolean;
  /** Erreur de lecture autre que « table absente » : à montrer, jamais à confondre avec « aucune rétractation ». */
  loadError?: string | null;
}) {
  if (loadError) {
    return (
      <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
        ⚠️ Impossible de lire les rétractations ({loadError}). Il peut y en avoir que tu ne vois pas : recharge la page ou
        regarde les journaux Vercel.
      </p>
    );
  }

  if (tableMissing) {
    return (
      <p className="rounded-lg border border-xbz-cyan/30 bg-xbz-cyan/10 px-4 py-3 text-sm font-semibold text-xbz-cyan">
        ⚠️ La table des rétractations n’existe pas encore. Dans Supabase › SQL Editor, exécute le fichier{" "}
        <code>supabase/migration_retractation_05102026.sql</code> : sans elle, la fonction « Renoncer au contrat ici »
        ne peut rien enregistrer.
      </p>
    );
  }

  if (rows.length === 0) return <p className="text-neutral-400">Aucune rétractation pour le moment.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-neutral-400">
        Quand un client se rétracte : il renvoie les produits sous 14 jours (frais de retour à sa charge) ; tu le
        rembourses de tous ses paiements, livraison initiale comprise, au plus tard 14 jours après sa déclaration (tu peux
        attendre le retour du colis). Le remboursement se fait dans Stripe ; coche ensuite « Traitée ».
      </p>

      <ul className="flex flex-col gap-4">
        {rows.map((w) => {
          const order = w.order_id ? orders.get(w.order_id) : undefined;
          const processed = Boolean(w.processed_at);
          return (
            <li key={w.id} className="card-xbz p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-white">{w.customer_name}</p>
                  <p className="text-sm text-neutral-400">
                    {w.customer_email} · déclarée le {dateTime.format(new Date(w.received_at))}
                  </p>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    processed ? "bg-emerald-500/15 text-emerald-300" : "bg-xbz-cyan/15 text-xbz-cyan"
                  }`}
                >
                  {processed ? `Traitée le ${dateTime.format(new Date(w.processed_at as string))}` : "À traiter"}
                </span>
              </div>

              {w.details && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-white/5 p-3 text-sm text-neutral-200">
                  <span className="font-semibold text-white">Précisions du client : </span>
                  {w.details}
                </p>
              )}

              <div className="mt-3 text-sm text-neutral-300">
                {w.suspect && (
                  <p className="mb-2 font-semibold text-red-300">
                    ⚠️ Le champ piège anti-spam était rempli (extension ou gestionnaire de mots de passe, ou robot) :
                    vérifie que la demande est réelle avant de renvoyer l’accusé ou de rembourser.
                  </p>
                )}
                {w.order_id ? (
                  <p>
                    <span className="font-semibold text-white">{orderNumber(w.order_id)}</span>
                    {order && order.amount_total !== null && ` · ${formatEuros(Number(order.amount_total), "fr")}`}
                    {order?.status === "refunded" && <span className="font-semibold text-red-300"> · déjà remboursée</span>}
                    {order?.status === "fulfilled" && " · expédiée"}
                    <span className="text-neutral-400"> — {MATCH_HINT[w.match]}</span>
                    {w.order_number && <span className="text-neutral-400"> Saisi par le client : « {w.order_number} ».</span>}
                    {order?.stripe_payment_intent && (
                      <>
                        {" "}
                        <a
                          href={stripeDashboardUrl(order.stripe_payment_intent)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-xbz-cyan hover:underline"
                        >
                          Rembourser dans Stripe
                          <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
                        </a>
                      </>
                    )}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-xbz-cyan">
                      ⚠️ {MATCH_HINT[w.match]}
                      {w.order_number && ` Saisi par le client : « ${w.order_number} ».`}
                    </p>
                    <AdminForm
                      action={linkWithdrawalToOrder}
                      loadingMessage="Rattachement…"
                      successMessage="Commande rattachée"
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="id" value={w.id} />
                      <label htmlFor={`numero-${w.id}`} className="sr-only">
                        Numéro de commande à rattacher
                      </label>
                      <input
                        id={`numero-${w.id}`}
                        name="numero"
                        required
                        maxLength={40}
                        placeholder="XBZ-1A2B3C4D"
                        className="rounded-lg border-0 bg-[#0d0d13] px-3 py-1.5 text-sm text-white outline-none"
                      />
                      <button className={`${btn} bg-xbz-blue/20 text-xbz-cyan hover:bg-xbz-blue/30`}>Rattacher</button>
                    </AdminForm>
                  </div>
                )}
              </div>

              <div className="mt-3 text-sm">
                {w.ack_sent_at ? (
                  <p className="text-emerald-300">✅ Accusé de réception envoyé le {dateTime.format(new Date(w.ack_sent_at))}.</p>
                ) : (
                  <p className="font-semibold text-red-300">
                    ⚠️ Accusé de réception NON envoyé — {w.ack_error ?? "en attente d’envoi"} ({w.ack_attempts} essai
                    {w.ack_attempts > 1 ? "s" : ""}). La loi l’exige « sans délai » : renvoie-le (bouton ci-dessous).
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {!w.ack_sent_at && (
                  <AdminForm action={resendWithdrawalAck} loadingMessage="Envoi…" successMessage="Accusé envoyé" closeOnSuccess={false}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className={`${btn} bg-red-500/15 text-red-300 hover:bg-red-500/25`}>✉️ Renvoyer l’accusé</button>
                  </AdminForm>
                )}
                <AdminForm
                  action={setWithdrawalProcessed}
                  loadingMessage="Mise à jour…"
                  successMessage={processed ? "Déclaration rouverte" : "Déclaration traitée"}
                  closeOnSuccess={false}
                >
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="done" value={processed ? "0" : "1"} />
                  <button className={`${btn} ${processed ? "bg-white/5 text-neutral-300 hover:bg-white/10" : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"}`}>
                    {processed ? "↩️ Rouvrir" : "✅ Marquer traitée"}
                  </button>
                </AdminForm>
                <AdminForm action={deleteWithdrawal} loadingMessage="Suppression…" successMessage="Déclaration supprimée" closeOnSuccess={false}>
                  <input type="hidden" name="id" value={w.id} />
                  <ConfirmButton
                    message="Supprimer définitivement cette déclaration ? À réserver aux essais et au spam : une vraie rétractation est une preuve."
                    className={`${btn} bg-white/5 text-neutral-400 hover:bg-red-500/15 hover:text-red-300`}
                  >
                    🗑️ Supprimer
                  </ConfirmButton>
                </AdminForm>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
