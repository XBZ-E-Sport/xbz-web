const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
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
 * On passe soit `rosterId`, soit `poleId`. Un membre de pôle n'a pas de rôle
 * propre (le pôle EST le rôle) : on masque alors le rôle + les champs esport.
 */
export default function PlayerForm({
  action,
  rosterId,
  poleId,
  player,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rosterId?: string;
  poleId?: string;
  player?: PlayerRow;
  submitLabel: string;
}) {
  const isPole = Boolean(poleId);
  // Préfixe d'id unique par instance (une page affiche plusieurs formulaires :
  // ajout + une édition par membre) → aucun id dupliqué.
  const uid = player ? `joueur-${player.id}` : `joueur-new-${poleId ?? rosterId ?? "x"}`;

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {player && <input type="hidden" name="id" value={player.id} />}
      {rosterId && <input type="hidden" name="roster_id" value={rosterId} />}
      {poleId && <input type="hidden" name="pole_id" value={poleId} />}

      <div className="block">
        <label htmlFor={`${uid}-pseudo`} className={labelCls}>
          Pseudo
        </label>
        <input id={`${uid}-pseudo`} name="pseudo" defaultValue={player?.pseudo} required placeholder="NASS" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={player?.slug} placeholder="nass" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-nom`} className={labelCls}>
          Vrai nom
        </label>
        <input id={`${uid}-nom`} name="nom" defaultValue={player?.nom ?? ""} placeholder="Nassim Bali" className={inputCls} />
      </div>

      {/* Rôle : uniquement pour un joueur de roster. Un membre de pôle n'a pas de
          sous-rôle — le pôle lui-même définit la fonction. */}
      {!isPole && (
        <div className="block">
          <label htmlFor={`${uid}-role`} className={labelCls}>
            Rôle
          </label>
          <select id={`${uid}-role`} name="role" defaultValue={player?.role ?? "Joueur"} className={inputCls}>
            {ROSTER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-photo-file`} className={labelCls}>
          Photo
        </label>
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
            id={`${uid}-photo-file`}
            name="photo_file"
            type="file"
            accept="image/*"
            className="w-full text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-xbz-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>
        <label htmlFor={`${uid}-photo-url`} className="sr-only">
          URL de la photo
        </label>
        <input
          id={`${uid}-photo-url`}
          name="photo_url"
          type="url"
          defaultValue={player?.photo_url ?? ""}
          placeholder="…ou colle une URL d'image"
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Upload une image (JPG / PNG / WebP, 5&nbsp;Mo max) ou colle une URL. L&apos;upload est
          prioritaire sur l&apos;URL.
        </p>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-pays`} className={labelCls}>
          Pays
        </label>
        <input id={`${uid}-pays`} name="pays" defaultValue={player?.pays ?? ""} placeholder="France" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-pays_code`} className={labelCls}>
          Code pays (ISO, ex: FR)
        </label>
        <input id={`${uid}-pays_code`} name="pays_code" maxLength={2} defaultValue={player?.pays_code ?? ""} placeholder="FR" className={inputCls} />
      </div>

      {!isPole && (
        <>
          <div className="block">
            <label htmlFor={`${uid}-rang`} className={labelCls}>
              Rang
            </label>
            <input id={`${uid}-rang`} name="rang" defaultValue={player?.rang ?? ""} placeholder="Supersonic Legend" className={inputCls} />
          </div>

          <div className="block">
            <label htmlFor={`${uid}-mmr`} className={labelCls}>
              MMR
            </label>
            <input id={`${uid}-mmr`} name="mmr" type="number" defaultValue={player?.mmr ?? ""} placeholder="1600" className={inputCls} />
          </div>
        </>
      )}

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-bio`} className={labelCls}>
          Bio
        </label>
        <textarea id={`${uid}-bio`} name="bio" defaultValue={player?.bio ?? ""} rows={2} className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-twitter`} className={labelCls}>
          X / Twitter (URL)
        </label>
        <input id={`${uid}-twitter`} name="twitter" type="url" defaultValue={player?.twitter ?? ""} placeholder="https://x.com/…" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-twitch`} className={labelCls}>
          Twitch (URL)
        </label>
        <input id={`${uid}-twitch`} name="twitch" type="url" defaultValue={player?.twitch ?? ""} placeholder="https://twitch.tv/…" className={inputCls} />
      </div>

      {!isPole && (
        <>
          <div className="block sm:col-span-2">
            <label htmlFor={`${uid}-rltracker`} className={labelCls}>
              RL Tracker (URL)
            </label>
            <input id={`${uid}-rltracker`} name="rltracker" type="url" defaultValue={player?.rltracker ?? ""} placeholder="https://rocketleague.tracker.network/…" className={inputCls} />
          </div>

          <div className="block sm:col-span-2">
            <label htmlFor={`${uid}-palmares`} className={labelCls}>
              Palmarès (un par ligne)
            </label>
            <textarea id={`${uid}-palmares`} name="palmares" defaultValue={(player?.palmares ?? []).join("\n")} rows={3} placeholder="Vainqueur Coupe de France 2025" className={inputCls} />
          </div>
        </>
      )}

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input id={`${uid}-position`} name="position" type="number" defaultValue={player?.position ?? 0} className={inputCls} />
      </div>

      <div className="flex items-center gap-2 self-end text-sm text-neutral-300">
        <input id={`${uid}-active`} type="checkbox" name="active" defaultChecked={player?.active ?? true} className="h-4 w-4" />
        <label htmlFor={`${uid}-active`}>Visible (actif)</label>
      </div>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
