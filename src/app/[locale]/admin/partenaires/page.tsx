import AdminForm from "@/components/AdminForm";
import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import PartnerForm, { type PartnerRow } from "./PartnerForm";
import { createPartner, updatePartner, deletePartner } from "./actions";

export const metadata = { title: "Partenaires — Back-office XBZ" };
export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = { sponsor: "Sponsor", partenaire: "Partenaire" };

export default async function AdminPartenairesPage() {
  // Contrôle d'accès DANS la page (layout et page rendus en parallèle par le
  // App Router) — même garde que la boutique.
  const { admin } = await requireStaff();
  const { data, error } = await admin
    .from("partners")
    .select("id, name, type, description, description_en, logo, url, position, active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const partners = (data ?? []) as PartnerRow[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un partenaire */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouveau partenaire</h2>
        <PartnerForm action={createPartner} submitLabel="Ajouter le partenaire" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Partenaires <span className="text-neutral-400">({partners.length})</span>
        </h2>

        {partners.length === 0 ? (
          <p className="text-neutral-400">Aucun partenaire. Crée le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {partners.map((p) => (
              <li key={p.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {p.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.logo}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg bg-white/90 object-contain p-1"
                      />
                    ) : (
                      <span aria-hidden="true" className="text-2xl">
                        🤝
                      </span>
                    )}
                    <div>
                      <h3 className="font-display text-lg text-white">
                        {p.name}
                        {!p.active && (
                          <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                            masqué
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-neutral-400">
                        {typeLabels[p.type] ?? p.type}
                        {p.description ? ` · ${p.description}` : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / Supprimer
                  </summary>
                  <div className="mt-4">
                    <PartnerForm action={updatePartner} partner={p} submitLabel="Enregistrer" />
                    <AdminForm
                      action={deletePartner}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Partenaire supprimé"
                      closeOnSuccess={false}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                        message={`Supprimer le partenaire "${p.name}" ? Action irréversible.`}
                      >
                        Supprimer le partenaire
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
