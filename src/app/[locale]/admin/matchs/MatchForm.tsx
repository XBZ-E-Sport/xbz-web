import AdminForm from "@/components/AdminForm";

import { matchFormats, matchStatuses } from "@/lib/matchs";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

// Libellés FR (le back-office est en français).
const statusLabels: Record<(typeof matchStatuses)[number], string> = {
  scheduled: "À venir",
  finished: "Terminé",
  cancelled: "Annulé",
};

export type MatchRow = {
  id: string;
  roster_id: string | null;
  opponent: string;
  opponent_logo: string | null;
  competition: string | null;
  format: string;
  starts_at: string;
  status: string;
  score_xbz: number | null;
  score_opponent: number | null;
  stream_url: string | null;
  active: boolean;
};

export type RosterOption = { id: string; name: string };

/** `datetime-local` attend "YYYY-MM-DDTHH:MM" : on tronque la valeur stockée. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const norm = value.includes("T") ? value : value.replace(" ", "T");
  return norm.slice(0, 16);
}

export default function MatchForm({
  action,
  match,
  rosters,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  match?: MatchRow;
  rosters: RosterOption[];
  submitLabel: string;
}) {
  const uid = match ? `match-${match.id}` : "match-new";

  return (
    <AdminForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {match && <input type="hidden" name="id" value={match.id} />}

      <div className="block">
        <label htmlFor={`${uid}-roster`} className={labelCls}>
          Roster XBZ
        </label>
        <select
          id={`${uid}-roster`}
          name="roster_id"
          defaultValue={match?.roster_id ?? ""}
          className={inputCls}
        >
          <option value="">— Aucun (affiché « XBZ ») —</option>
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-opponent`} className={labelCls}>
          Adversaire
        </label>
        <input
          id={`${uid}-opponent`}
          name="opponent"
          defaultValue={match?.opponent}
          required
          placeholder="Nom de l'équipe adverse"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-competition`} className={labelCls}>
          Compétition
        </label>
        <input
          id={`${uid}-competition`}
          name="competition"
          defaultValue={match?.competition ?? ""}
          placeholder="RLCS, Coupe de France…"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-format`} className={labelCls}>
          Format
        </label>
        <select id={`${uid}-format`} name="format" defaultValue={match?.format ?? "BO3"} className={inputCls}>
          {matchFormats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-starts`} className={labelCls}>
          Date & heure (heure française)
        </label>
        <input
          id={`${uid}-starts`}
          name="starts_at"
          type="datetime-local"
          defaultValue={toLocalInput(match?.starts_at ?? null)}
          required
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-status`} className={labelCls}>
          Statut
        </label>
        <select id={`${uid}-status`} name="status" defaultValue={match?.status ?? "scheduled"} className={inputCls}>
          {matchStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-score-xbz`} className={labelCls}>
          Score XBZ (si terminé)
        </label>
        <input
          id={`${uid}-score-xbz`}
          name="score_xbz"
          type="number"
          min={0}
          defaultValue={match?.score_xbz ?? ""}
          placeholder="—"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-score-opp`} className={labelCls}>
          Score adversaire (si terminé)
        </label>
        <input
          id={`${uid}-score-opp`}
          name="score_opponent"
          type="number"
          min={0}
          defaultValue={match?.score_opponent ?? ""}
          placeholder="—"
          className={inputCls}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-logo-file`} className={labelCls}>
          Logo adversaire (facultatif)
        </label>
        <div className="flex items-center gap-3">
          {match?.opponent_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={match.opponent_logo}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg bg-white/90 object-contain p-1"
            />
          )}
          <input
            id={`${uid}-logo-file`}
            name="opponent_logo_file"
            type="file"
            accept="image/*"
            className="w-full text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-xbz-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>
        <label htmlFor={`${uid}-logo-url`} className="sr-only">
          URL du logo adversaire
        </label>
        <input
          id={`${uid}-logo-url`}
          name="opponent_logo_url"
          type="url"
          defaultValue={match?.opponent_logo ?? ""}
          placeholder="…ou colle une URL de logo"
          className={`${inputCls} mt-2`}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-stream`} className={labelCls}>
          Lien stream / VOD (facultatif)
        </label>
        <input
          id={`${uid}-stream`}
          name="stream_url"
          type="url"
          defaultValue={match?.stream_url ?? ""}
          placeholder="https://twitch.tv/… ou https://youtube.com/…"
          className={inputCls}
        />
      </div>

      <div className="flex items-end gap-2 text-sm text-neutral-300">
        <input
          id={`${uid}-active`}
          type="checkbox"
          name="active"
          defaultChecked={match?.active ?? true}
          className="h-4 w-4"
        />
        <label htmlFor={`${uid}-active`} className="pb-2">
          Visible sur le site
        </label>
      </div>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </AdminForm>
  );
}
