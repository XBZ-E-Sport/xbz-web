const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none";
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
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {roster && <input type="hidden" name="id" value={roster.id} />}

      <label className="block">
        <span className={labelCls}>Nom</span>
        <input name="name" defaultValue={roster?.name} required placeholder="Roster SSL" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Slug (auto si vide)</span>
        <input name="slug" defaultValue={roster?.slug} placeholder="ssl" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Rang</span>
        <input name="rank" defaultValue={roster?.rank ?? ""} placeholder="Supersonic Legend" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Position (ordre)</span>
        <input name="position" type="number" defaultValue={roster?.position ?? 0} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Capacité (places)</span>
        <input
          name="capacity"
          type="number"
          min={0}
          defaultValue={roster?.capacity ?? 3}
          placeholder="3"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Rôle recruté (vide = pas de recrutement)</span>
        <input
          name="recrute"
          defaultValue={roster?.recrute ?? "Joueur"}
          placeholder="Joueur"
          className={inputCls}
        />
      </label>

      <label className="block sm:col-span-2">
        <span className={labelCls}>Description</span>
        <textarea name="description" defaultValue={roster?.description ?? ""} rows={2} className={inputCls} />
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" name="active" defaultChecked={roster?.active ?? true} className="h-4 w-4" />
        Visible sur le site (actif)
      </label>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
