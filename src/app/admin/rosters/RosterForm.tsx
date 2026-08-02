const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

export type RosterRow = {
  id: string;
  slug: string;
  name: string;
  rank: string | null;
  description: string | null;
  capacity: number;
  recrute: string | null;
  position: number;
  active: boolean;
};

export default function RosterForm({
  action,
  roster,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  roster?: RosterRow;
  submitLabel: string;
}) {
  // Préfixe d'id unique par instance (une même page affiche plusieurs formulaires).
  const uid = roster ? `roster-${roster.id}` : "roster-new";

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {roster && <input type="hidden" name="id" value={roster.id} />}

      <div className="block">
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Nom
        </label>
        <input id={`${uid}-name`} name="name" defaultValue={roster?.name} required placeholder="Roster SSL" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={roster?.slug} placeholder="ssl" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-rank`} className={labelCls}>
          Rang
        </label>
        <input id={`${uid}-rank`} name="rank" defaultValue={roster?.rank ?? ""} placeholder="Supersonic Legend" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input id={`${uid}-position`} name="position" type="number" defaultValue={roster?.position ?? 0} className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-capacity`} className={labelCls}>
          Capacité (places)
        </label>
        <input
          id={`${uid}-capacity`}
          name="capacity"
          type="number"
          min={0}
          defaultValue={roster?.capacity ?? 3}
          placeholder="3"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-recrute`} className={labelCls}>
          Rôle recruté (vide = pas de recrutement)
        </label>
        <input
          id={`${uid}-recrute`}
          name="recrute"
          defaultValue={roster?.recrute ?? "Joueur"}
          placeholder="Joueur"
          className={inputCls}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-description`} className={labelCls}>
          Description
        </label>
        <textarea id={`${uid}-description`} name="description" defaultValue={roster?.description ?? ""} rows={2} className={inputCls} />
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <input id={`${uid}-active`} type="checkbox" name="active" defaultChecked={roster?.active ?? true} className="h-4 w-4" />
        <label htmlFor={`${uid}-active`}>Visible sur le site (actif)</label>
      </div>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
