import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmButton from "@/components/ConfirmButton";
import PlayerForm, { type PlayerRow } from "../PlayerForm";
import { upsertPlayer, deletePlayer } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Roster ${slug} — Back-office XBZ` };
}

export default async function AdminRosterPlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: roster } = await admin
    .from("rosters")
    .select("id, name, slug, rank")
    .eq("slug", slug)
    .maybeSingle();
  if (!roster) notFound();

  const { data, error } = await admin
    .from("joueurs")
    .select("*")
    .eq("roster_id", roster.id)
    .order("position", { ascending: true });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const players = (data ?? []) as PlayerRow[];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/rosters"
          className="text-sm font-semibold text-neutral-400 transition hover:text-white"
        >
          ← Tous les rosters
        </Link>
        <h2 className="mt-2 font-display text-xl text-white">
          {roster.name} <span className="text-neutral-500">· {roster.rank ?? "—"}</span>
        </h2>
      </div>

      {/* Ajouter un joueur */}
      <section className="card-xbz p-6">
        <h3 className="mb-4 font-display text-lg text-white">➕ Ajouter un joueur</h3>
        <PlayerForm action={upsertPlayer} rosterId={roster.id} submitLabel="Ajouter le joueur" />
      </section>

      {/* Liste */}
      <section>
        <h3 className="mb-4 font-display text-lg text-white">
          Joueurs <span className="text-neutral-500">({players.length})</span>
        </h3>

        {players.length === 0 ? (
          <p className="text-neutral-400">Aucun joueur dans ce roster. Ajoute le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {players.map((p) => (
              <li key={p.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-display text-lg text-white">
                      {p.pseudo}
                      {!p.active && (
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                          masqué
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-neutral-500">
                      {p.role} · {p.nom ?? "—"} · {p.pays ?? "—"}
                    </p>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / supprimer
                  </summary>
                  <div className="mt-4">
                    <PlayerForm
                      action={upsertPlayer}
                      rosterId={roster.id}
                      player={p}
                      submitLabel="Enregistrer"
                    />
                    <form action={deletePlayer} className="mt-3">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="roster_slug" value={roster.slug} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25"
                        message={`Supprimer le joueur "${p.pseudo}" ? Action irréversible.`}
                      >
                        Supprimer le joueur
                      </ConfirmButton>
                    </form>
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
