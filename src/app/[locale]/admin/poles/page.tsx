import AdminForm from "@/components/AdminForm";
import { Link } from "@/i18n/navigation";

import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import PoleForm, { type PoleRow } from "./PoleForm";
import { createPole, updatePole, deletePole } from "../rosters/actions";

export const metadata = { title: "Pôles — Back-office XBZ" };
export const dynamic = "force-dynamic";

// On récupère l'`active` de chaque membre pour compter comme le public (actifs).
type PoleWithMembers = PoleRow & { joueurs?: { active: boolean }[] };

const CATEGORY_LABEL: Record<string, string> = {
  staff: "Staff",
  esport: "Esport",
};

export default async function AdminPolesPage() {
  // Contrôle d'accès DANS la page : layout et page sont rendus EN PARALLÈLE
  // par le App Router. Une garde placée uniquement dans le layout laisse la
  // page interroger la base et sérialiser ses données dans la réponse, même
  // quand la redirection part. La garde doit donc vivre ici aussi.
  const { admin } = await requireStaff();
  const { data, error } = await admin
    .from("poles")
    .select(
      "id, slug, name, description, category, capacity, recrute, fixed, variant, badge, position, active, joueurs(active)",
    )
    .order("category", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const poles = (data ?? []) as PoleWithMembers[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un pôle */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Ajouter un pôle</h2>
        <PoleForm action={createPole} submitLabel="Créer le pôle" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Pôles <span className="text-neutral-400">({poles.length})</span>
        </h2>

        {poles.length === 0 ? (
          <p className="text-neutral-400">Aucun pôle. Crée le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {poles.map((p) => {
              // Comme le public : on ne compte que les membres actifs (visibles).
              const count = (p.joueurs ?? []).filter((j) => j.active).length;
              return (
                <li key={p.id} className="card-xbz p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                        /{p.slug} · {CATEGORY_LABEL[p.category] ?? p.category} · {count}/{p.capacity}{" "}
                        membre{count > 1 ? "s" : ""}
                        {p.fixed
                          ? " · pas de recrutement"
                          : p.recrute
                            ? ` · recrute : ${p.recrute}`
                            : ""}
                      </p>
                    </div>
                    <Link
                      href={`/admin/poles/${p.slug}`}
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Gérer les membres →
                    </Link>
                  </div>

                  <details className="group mt-4 border-t border-white/10 pt-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                      Modifier / Supprimer
                    </summary>
                    <div className="mt-4">
                      <PoleForm action={updatePole} pole={p} submitLabel="Enregistrer" />
                      <AdminForm
                      action={deletePole}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Pôle supprimé"
                      closeOnSuccess={false}
                    >
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton
                          className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                          message={`Supprimer le pôle "${p.name}" et TOUS ses membres ? Action irréversible.`}
                        >
                          Supprimer le pôle
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
