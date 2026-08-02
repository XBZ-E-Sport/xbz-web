import AdminForm from "@/components/AdminForm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmButton from "@/components/ConfirmButton";
import PlayerForm, { type PlayerRow } from "../../rosters/PlayerForm";
import { upsertPlayer, deletePlayer } from "../../rosters/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Pôle ${slug} — Back-office XBZ` };
}

export default async function AdminPoleMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: pole } = await admin
    .from("poles")
    .select("id, name, slug, category, capacity")
    .eq("slug", slug)
    .maybeSingle();
  if (!pole) notFound();

  const { data, error } = await admin
    .from("joueurs")
    .select("*")
    .eq("pole_id", pole.id)
    .order("position", { ascending: true });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const members = (data ?? []) as PlayerRow[];
  // Ratio « occupé » = membres actifs (comme le public) ; la liste montre tout.
  const activeCount = members.filter((m) => m.active).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/poles"
          className="text-sm font-semibold text-neutral-400 transition hover:text-white"
        >
          ← Tous les pôles
        </Link>
        <h2 className="mt-2 font-display text-xl text-white">
          {pole.name}{" "}
          <span className="text-neutral-400">
            · {activeCount}/{pole.capacity} membre{activeCount > 1 ? "s" : ""}
          </span>
        </h2>
      </div>

      {/* Ajouter un membre (un membre de pôle n'a pas de sous-rôle : le pôle EST le rôle) */}
      <section className="card-xbz p-6">
        <h3 className="mb-4 font-display text-lg text-white">➕ Ajouter un membre</h3>
        <PlayerForm action={upsertPlayer} poleId={pole.id} submitLabel="Ajouter le membre" />
      </section>

      {/* Liste */}
      <section>
        <h3 className="mb-4 font-display text-lg text-white">
          Membres <span className="text-neutral-400">({members.length})</span>
        </h3>

        {members.length === 0 ? (
          <p className="text-neutral-400">Aucun membre dans ce pôle. Ajoute le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((m) => (
              <li key={m.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-display text-lg text-white">
                      {m.pseudo}
                      {!m.active && (
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                          masqué
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-neutral-400">
                      {m.nom ?? "—"} · {m.pays ?? "—"}
                    </p>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / Supprimer
                  </summary>
                  <div className="mt-4">
                    <PlayerForm
                      action={upsertPlayer}
                      poleId={pole.id}
                      player={m}
                      submitLabel="Enregistrer"
                    />
                    <AdminForm
                      action={deletePlayer}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Membre supprimé"
                      closeOnSuccess={false}
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="pole_slug" value={pole.slug} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                        message={`Supprimer le membre "${m.pseudo}" ? Action irréversible.`}
                      >
                        Supprimer le membre
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
