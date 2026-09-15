import AdminForm from "@/components/AdminForm";
import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import { formatMatchDateTime } from "@/lib/matchs";
import MatchForm, { type MatchRow, type RosterOption } from "./MatchForm";
import { createMatch, updateMatch, deleteMatch } from "./actions";

export const metadata = { title: "Matchs — Back-office XBZ" };
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  scheduled: "À venir",
  finished: "Terminé",
  cancelled: "Annulé",
};

type AdminMatchRow = MatchRow & { rosters: { name: string } | null };

export default async function AdminMatchsPage() {
  const { admin } = await requireStaff();

  const [matchsRes, rostersRes] = await Promise.all([
    admin
      .from("matchs")
      .select(
        "id, roster_id, opponent, opponent_logo, competition, format, starts_at, status, score_xbz, score_opponent, stream_url, active, rosters(name)",
      )
      .order("starts_at", { ascending: false }),
    admin.from("rosters").select("id, name").eq("active", true).order("position", { ascending: true }),
  ]);

  if (matchsRes.error) {
    return <p className="text-red-400">Erreur de chargement : {matchsRes.error.message}</p>;
  }
  const matchs = (matchsRes.data ?? []) as unknown as AdminMatchRow[];
  const rosters = (rostersRes.data ?? []) as RosterOption[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un match */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouveau match</h2>
        <MatchForm action={createMatch} rosters={rosters} submitLabel="Ajouter le match" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Matchs <span className="text-neutral-400">({matchs.length})</span>
        </h2>

        {matchs.length === 0 ? (
          <p className="text-neutral-400">Aucun match. Crée le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {matchs.map((m) => {
              const finished = m.status === "finished" && m.score_xbz !== null && m.score_opponent !== null;
              return (
                <li key={m.id} className="card-xbz p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-white">
                        {m.rosters?.name ?? "XBZ"} <span className="text-neutral-500">vs</span>{" "}
                        {m.opponent}
                        {finished && (
                          <span className="ml-2 font-display text-base text-xbz-cyan">
                            {m.score_xbz} – {m.score_opponent}
                          </span>
                        )}
                        {!m.active && (
                          <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                            masqué
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-neutral-400 first-letter:uppercase">
                        {statusLabels[m.status] ?? m.status} · {m.format}
                        {m.competition ? ` · ${m.competition}` : ""} ·{" "}
                        {formatMatchDateTime(m.starts_at, "fr")}
                      </p>
                    </div>
                  </div>

                  <details className="group mt-4 border-t border-white/10 pt-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                      Modifier / Supprimer
                    </summary>
                    <div className="mt-4">
                      <MatchForm action={updateMatch} match={m} rosters={rosters} submitLabel="Enregistrer" />
                      <AdminForm
                        action={deleteMatch}
                        className="mt-3"
                        loadingMessage="Suppression…"
                        successMessage="Match supprimé"
                        closeOnSuccess={false}
                      >
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton
                          className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                          message={`Supprimer le match contre "${m.opponent}" ? Action irréversible.`}
                        >
                          Supprimer le match
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
