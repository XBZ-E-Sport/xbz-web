import { createAdminClient } from "@/lib/supabase/admin";
import { updateStatut } from "./actions";

export const metadata = { title: "Candidatures — Back-office XBZ" };
export const dynamic = "force-dynamic";

const statutStyles: Record<string, string> = {
  en_attente: "bg-amber-500/15 text-amber-300",
  accepte: "bg-emerald-500/15 text-emerald-300",
  refuse: "bg-red-500/15 text-red-300",
  entretien: "bg-blue-500/15 text-blue-300",
};

const actions = [
  { statut: "accepte", label: "✅ Accepter", cls: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" },
  { statut: "entretien", label: "🟡 Entretien", cls: "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25" },
  { statut: "refuse", label: "❌ Refuser", cls: "bg-red-500/15 text-red-300 hover:bg-red-500/25" },
];

export default async function AdminCandidaturesPage() {
  const admin = createAdminClient();
  const { data: candidatures, error } = await admin
    .from("candidatures")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  if (!candidatures?.length) return <p className="text-neutral-400">Aucune candidature pour le moment.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-400">{candidatures.length} candidature(s)</p>
      {candidatures.map((c) => (
        <div key={c.id} className="card-xbz p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">
              {c.pseudo} <span className="text-neutral-500">· {c.jeu}</span>
            </h2>
            <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${statutStyles[c.statut] ?? "bg-white/10"}`}>
              {c.statut}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-neutral-300 sm:grid-cols-2">
            <p><span className="text-neutral-500">Nom :</span> {c.nom}</p>
            <p><span className="text-neutral-500">Âge :</span> {c.age}</p>
            <p><span className="text-neutral-500">Discord :</span> {c.discord}</p>
            <p><span className="text-neutral-500">Rang :</span> {c.rang ?? "—"}</p>
            <p><span className="text-neutral-500">Pays :</span> {c.pays_residence ?? "—"}</p>
            {c.rltracker && (
              <p className="truncate">
                <span className="text-neutral-500"><a href={c.rltracker} target="_blank" rel="noopener noreferrer" className="text-white hover:text-xbz-blue hover:underline ">RL Tracker</a></span>
              </p>
            )}
          </div>

          {c.motivation && (
            <p className="mt-3 text-sm text-neutral-300"><span className="text-neutral-500">Motivation :</span> {c.motivation}</p>
          )}

          <p className="mt-2 text-xs text-neutral-600">Reçue le {new Date(c.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p>

          {/* Actions staff */}
          <form action={updateStatut} className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <input type="hidden" name="id" value={c.id} />
            {actions.map((a) => (
              <button
                key={a.statut}
                name="statut"
                value={a.statut}
                disabled={c.statut === a.statut}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold hover:cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-40 ${a.cls}`}
              >
                {a.label}
              </button>
            ))}
          </form>
        </div>
      ))}
    </div>
  );
}