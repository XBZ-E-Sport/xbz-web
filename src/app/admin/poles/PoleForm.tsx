const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

const CATEGORIES = [
  { value: "staff", label: "Staff" },
  { value: "esport", label: "Esport (staff de section)" },
];
// Les couleurs doivent correspondre à `roleStyles` dans src/app/equipes/page.tsx.
const VARIANTS = [
  { value: "founder", label: "Fondateur (blanc)" },
  { value: "staff", label: "Staff (violet)" },
  { value: "member", label: "Joueur (bleu)" },
  { value: "creative", label: "Créatif (cyan)" },
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
  badge: string | null;
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
  // Préfixe d'id unique par instance (une même page affiche plusieurs formulaires).
  const uid = pole ? `pole-${pole.id}` : "pole-new";

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {pole && <input type="hidden" name="id" value={pole.id} />}

      <div className="block">
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Nom
        </label>
        <input id={`${uid}-name`} name="name" defaultValue={pole?.name} required placeholder="🛡️ Modérateurs" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={pole?.slug} placeholder="moderateurs" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-category`} className={labelCls}>
          Catégorie
        </label>
        <select id={`${uid}-category`} name="category" defaultValue={pole?.category ?? "staff"} className={inputCls}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-variant`} className={labelCls}>
          Couleur du badge
        </label>
        <select id={`${uid}-variant`} name="variant" defaultValue={pole?.variant ?? "staff"} className={inputCls}>
          {VARIANTS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-badge`} className={labelCls}>
          Texte du badge (vide = auto)
        </label>
        <input
          id={`${uid}-badge`}
          name="badge"
          defaultValue={pole?.badge ?? ""}
          placeholder="STAFF"
          className={inputCls}
        />
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
          defaultValue={pole?.capacity ?? 1}
          placeholder="3"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input id={`${uid}-position`} name="position" type="number" defaultValue={pole?.position ?? 0} className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-recrute`} className={labelCls}>
          Rôle recruté (vide = pas de recrutement)
        </label>
        <input
          id={`${uid}-recrute`}
          name="recrute"
          defaultValue={pole?.recrute ?? ""}
          placeholder="Modérateur"
          className={inputCls}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-description`} className={labelCls}>
          Description
        </label>
        <textarea
          id={`${uid}-description`}
          name="description"
          defaultValue={pole?.description ?? ""}
          rows={2}
          placeholder="Gestion Discord & communauté"
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <input id={`${uid}-fixed`} type="checkbox" name="fixed" defaultChecked={pole?.fixed ?? false} className="h-4 w-4" />
        <label htmlFor={`${uid}-fixed`}>Jamais au recrutement (ex : Fondateurs)</label>
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <input id={`${uid}-active`} type="checkbox" name="active" defaultChecked={pole?.active ?? true} className="h-4 w-4" />
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
