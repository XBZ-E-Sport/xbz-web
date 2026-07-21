const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

const ROSTER_ROLES = ["Joueur", "Capitaine", "Coach", "Manager", "Sub"];

export type PlayerRow = {
  id: string;
  slug: string;
  pseudo: string;
  nom: string | null;
  photo_url: string | null;
  pays: string | null;
  pays_code: string | null;
  role: string;
  bio: string | null;
  rang: string | null;
  mmr: number | null;
  twitter: string | null;
  twitch: string | null;
  rltracker: string | null;
  palmares: string[] | null;
  position: number;
  active: boolean;
};

/**
 * Formulaire membre, partagé entre rosters (joueurs esport) et pôles (staff).
 * On passe soit `rosterId`, soit `poleId`. Les champs spécifiques à l'esport
 * (rang, MMR, RL Tracker, palmarès) ne s'affichent que pour un roster.
 */
export default function PlayerForm({
  action,
  rosterId,
  poleId,
  roles = ROSTER_ROLES,
  player,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rosterId?: string;
  poleId?: string;
  roles?: string[];
  player?: PlayerRow;
  submitLabel: string;
}) {
  const isPole = Boolean(poleId);
  const defaultRole = player?.role ?? roles[0] ?? "Joueur";

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {player && <input type="hidden" name="id" value={player.id} />}
      {rosterId && <input type="hidden" name="roster_id" value={rosterId} />}
      {poleId && <input type="hidden" name="pole_id" value={poleId} />}

      <label className="block">
        <span className={labelCls}>Pseudo</span>
        <input name="pseudo" defaultValue={player?.pseudo} required placeholder="NASS" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Slug (auto si vide)</span>
        <input name="slug" defaultValue={player?.slug} placeholder="nass" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Vrai nom</span>
        <input name="nom" defaultValue={player?.nom ?? ""} placeholder="Nassim Bali" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Rôle</span>
        <select name="role" defaultValue={defaultRole} className={inputCls}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div className="block sm:col-span-2">
        <span className={labelCls}>Photo</span>
        <div className="flex items-center gap-3">
          {player?.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.photo_url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          )}
          <input
            name="photo_file"
            type="file"
            accept="image/*"
            className="w-full text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-xbz-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>
        <input
          name="photo_url"
          type="url"
          defaultValue={player?.photo_url ?? ""}
          placeholder="…ou colle une URL d'image"
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Upload une image (JPG / PNG / WebP, 5&nbsp;Mo max) ou colle une URL. L&apos;upload est
          prioritaire sur l&apos;URL.
        </p>
      </div>

      <label className="block">
        <span className={labelCls}>Pays</span>
        <input name="pays" defaultValue={player?.pays ?? ""} placeholder="France" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Code pays (ISO, ex: FR)</span>
        <input name="pays_code" maxLength={2} defaultValue={player?.pays_code ?? ""} placeholder="FR" className={inputCls} />
      </label>

      {!isPole && (
        <>
          <label className="block">
            <span className={labelCls}>Rang</span>
            <input name="rang" defaultValue={player?.rang ?? ""} placeholder="Supersonic Legend" className={inputCls} />
          </label>

          <label className="block">
            <span className={labelCls}>MMR</span>
            <input name="mmr" type="number" defaultValue={player?.mmr ?? ""} placeholder="1600" className={inputCls} />
          </label>
        </>
      )}

      <label className="block sm:col-span-2">
        <span className={labelCls}>Bio</span>
        <textarea name="bio" defaultValue={player?.bio ?? ""} rows={2} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>X / Twitter (URL)</span>
        <input name="twitter" type="url" defaultValue={player?.twitter ?? ""} placeholder="https://x.com/…" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Twitch (URL)</span>
        <input name="twitch" type="url" defaultValue={player?.twitch ?? ""} placeholder="https://twitch.tv/…" className={inputCls} />
      </label>

      {!isPole && (
        <>
          <label className="block sm:col-span-2">
            <span className={labelCls}>RL Tracker (URL)</span>
            <input name="rltracker" type="url" defaultValue={player?.rltracker ?? ""} placeholder="https://rocketleague.tracker.network/…" className={inputCls} />
          </label>

          <label className="block sm:col-span-2">
            <span className={labelCls}>Palmarès (un par ligne)</span>
            <textarea name="palmares" defaultValue={(player?.palmares ?? []).join("\n")} rows={3} placeholder="Vainqueur Coupe de France 2025" className={inputCls} />
          </label>
        </>
      )}

      <label className="block">
        <span className={labelCls}>Position (ordre)</span>
        <input name="position" type="number" defaultValue={player?.position ?? 0} className={inputCls} />
      </label>

      <label className="flex items-center gap-2 self-end text-sm text-neutral-300">
        <input type="checkbox" name="active" defaultChecked={player?.active ?? true} className="h-4 w-4" />
        Visible (actif)
      </label>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
