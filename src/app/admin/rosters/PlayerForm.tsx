const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

const ROLES = ["Joueur", "Capitaine", "Coach", "Manager", "Sub"];

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

export default function PlayerForm({
  action,
  rosterId,
  player,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rosterId: string;
  player?: PlayerRow;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {player && <input type="hidden" name="id" value={player.id} />}
      <input type="hidden" name="roster_id" value={rosterId} />

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
        <select name="role" defaultValue={player?.role ?? "Joueur"} className={inputCls}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className={labelCls}>Photo (URL)</span>
        <input name="photo_url" type="url" defaultValue={player?.photo_url ?? ""} placeholder="https://…" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Pays</span>
        <input name="pays" defaultValue={player?.pays ?? ""} placeholder="France" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Code pays (ISO, ex: FR)</span>
        <input name="pays_code" maxLength={2} defaultValue={player?.pays_code ?? ""} placeholder="FR" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Rang</span>
        <input name="rang" defaultValue={player?.rang ?? ""} placeholder="Supersonic Legend" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>MMR</span>
        <input name="mmr" type="number" defaultValue={player?.mmr ?? ""} placeholder="1600" className={inputCls} />
      </label>

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

      <label className="block sm:col-span-2">
        <span className={labelCls}>RL Tracker (URL)</span>
        <input name="rltracker" type="url" defaultValue={player?.rltracker ?? ""} placeholder="https://rocketleague.tracker.network/…" className={inputCls} />
      </label>

      <label className="block sm:col-span-2">
        <span className={labelCls}>Palmarès (un par ligne)</span>
        <textarea name="palmares" defaultValue={(player?.palmares ?? []).join("\n")} rows={3} placeholder="Vainqueur Coupe de France 2025" className={inputCls} />
      </label>

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
