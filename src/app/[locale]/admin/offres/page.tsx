import AdminForm from "@/components/AdminForm";
import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import { formatDate } from "@/lib/format";
import OfferForm, { type OfferRow } from "./OfferForm";
import { createOffer, updateOffer, deleteOffer } from "./actions";

export const metadata = { title: "Offres d'emploi — Back-office XBZ" };
export const dynamic = "force-dynamic";

const OFFER_COLS =
  "id, slug, title, title_en, excerpt, excerpt_en, description, description_en, " +
  "department, department_en, employment_type, remote, city, region, postal_code, country, " +
  "salary_min, salary_max, salary_period, date_posted, valid_through, apply_url, active, position";

export default async function AdminOffresPage() {
  // Garde DANS la page : layout et page sont rendus en parallèle par l'App Router.
  const { admin } = await requireStaff();
  const { data, error } = await admin
    .from("job_offers")
    .select(OFFER_COLS)
    .order("position", { ascending: true })
    .order("date_posted", { ascending: false });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const offers = (data ?? []) as unknown as OfferRow[];

  return (
    <div className="flex flex-col gap-8">
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouvelle offre</h2>
        <OfferForm action={createOffer} submitLabel="Publier l’offre" />
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Offres <span className="text-neutral-400">({offers.length})</span>
        </h2>

        {offers.length === 0 ? (
          <p className="text-neutral-400">Aucune offre. Crée la première ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((o) => (
              <li key={o.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg text-white">
                      {o.title}
                      {!o.active && (
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                          hors ligne
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-neutral-400">
                      /{o.slug} · {o.remote ? "Télétravail" : o.city || "—"} · {o.employment_type} ·{" "}
                      {formatDate(o.date_posted)}
                    </p>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / Supprimer
                  </summary>
                  <div className="mt-4">
                    <OfferForm action={updateOffer} offer={o} submitLabel="Enregistrer" />
                    <AdminForm
                      action={deleteOffer}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Offre supprimée"
                      closeOnSuccess={false}
                    >
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="slug" value={o.slug} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                        message={`Supprimer l'offre "${o.title}" ? Action irréversible.`}
                      >
                        Supprimer l’offre
                      </ConfirmButton>
                    </AdminForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
