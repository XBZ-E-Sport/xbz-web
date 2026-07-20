const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

const CATEGORIES = [
  { value: "staff", label: "Staff" },
  { value: "esport", label: "Esport (staff de section)" },
];
const VARIANTS = [
  { value: "founder", label: "Fondateur (or)" },
  { value: "staff", label: "Staff (bleu)" },
  { value: "member", label: "Membre (cyan)" },
  { value: "creative", label: "Créatif (violet)" },
];

export type PoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  capacity: number;
  recrute: string | null;
  fixed: boolean;
  variant: string;
  position: number;
  active: boolean;
};

export default function PoleForm({
  action,
  pole,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  pole?: PoleRow;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {pole && <input type="hidden" name="id" value={pole.id} />}

      <label className="block">
        <span className={labelCls}>Nom</span>
        <input name="name" defaultValue={pole?.name} required placeholder="🛡️ Modérateurs" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Slug (auto si vide)</span>
        <input name="slug" defaultValue={pole?.slug} placeholder="moderateurs" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Catégorie</span>
        <select name="category" defaultValue={pole?.category ?? "staff"} className={inputCls}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelCls}>Style du badge</span>
        <select name="variant" defaultValue={pole?.variant ?? "staff"} className={inputCls}>
          {VARIANTS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelCls}>Capacité (places)</span>
        <input
          name="capacity"
          type="number"
          min={0}
          defaultValue={pole?.capacity ?? 1}
          placeholder="3"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Position (ordre)</span>
        <input name="position" type="number" defaultValue={pole?.position ?? 0} className={inputCls} />
      </label>

      <label className="block sm:col-span-2">
        <span className={labelCls}>Rôle recruté (vide = pas de recrutement)</span>
        <input
          name="recrute"
          defaultValue={pole?.recrute ?? ""}
          placeholder="Modérateur"
          className={inputCls}
        />
      </label>

      <label className="block sm:col-span-2">
        <span className={labelCls}>Description</span>
        <textarea
          name="description"
          defaultValue={pole?.description ?? ""}
          rows={2}
          placeholder="Gestion Discord & communauté"
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" name="fixed" defaultChecked={pole?.fixed ?? false} className="h-4 w-4" />
        Jamais au recrutement (ex : Fondateurs)
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" name="active" defaultChecked={pole?.active ?? true} className="h-4 w-4" />
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
