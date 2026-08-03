import AdminForm from "@/components/AdminForm";
import { Link } from "@/i18n/navigation";

import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import RosterForm, { type RosterRow } from "./RosterForm";
import { createRoster, updateRoster, deleteRoster } from "./actions";

export const metadata = { title: "Rosters — Back-office XBZ" };
export const dynamic = "force-dynamic";

// On récupère l'`active` de chaque joueur pour compter comme le public (actifs).
type RosterWithMembers = RosterRow & { joueurs?: { active: boolean }[] };

export default async function AdminRostersPage() {
  // Contrôle d'accès DANS la page : layout et page sont rendus EN PARALLÈLE
  // par le App Router. Une garde placée uniquement dans le layout laisse la
  // page interroger la base et sérialiser ses données dans la réponse, même
  // quand la redirection part. La garde doit donc vivre ici aussi.
  const { admin } = await requireStaff();
  const { data, error } = await admin
    .from("rosters")
    .select(
      "id, slug, name, rank, description, description_en, capacity, recrute, position, active, joueurs(active)",
    )
    .order("position", { ascending: true });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const rosters = (data ?? []) as RosterWithMembers[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un roster */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Ajouter un roster</h2>
        <RosterForm action={createRoster} submitLabel="Créer le roster" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Rosters <span className="text-neutral-400">({rosters.length})</span>
        </h2>

        {rosters.length === 0 ? (
          <p className="text-neutral-400">Aucun roster. Crée le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rosters.map((r) => {
              // Comme le public : on ne compte que les joueurs actifs (visibles).
              const count = (r.joueurs ?? []).filter((j) => j.active).length;
              return (
                <li key={r.id} className="card-xbz p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-white">
                        {r.name}
                        {!r.active && (
                          <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                            masqué
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-neutral-400">
                        /{r.slug} · {r.rank ?? "—"} · {count}/{r.capacity} joueur
                        {count > 1 ? "s" : ""}
                        {r.recrute ? ` · recrute : ${r.recrute}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/admin/rosters/${r.slug}`}
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Gérer les joueurs →
                    </Link>
                  </div>

                  <details className="group mt-4 border-t border-white/10 pt-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                      Modifier / Supprimer
                    </summary>
                    <div className="mt-4">
                      <RosterForm action={updateRoster} roster={r} submitLabel="Enregistrer" />
                      <AdminForm
                      action={deleteRoster}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Roster supprimé"
                      closeOnSuccess={false}
                    >
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton
                          className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                          message={`Supprimer le roster "${r.name}" et TOUS ses joueurs ? Action irréversible.`}
                        >
                          Supprimer le roster
                        </ConfirmButton>
                      </AdminForm>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
