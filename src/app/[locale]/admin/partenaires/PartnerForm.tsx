import AdminForm from "@/components/AdminForm";
import EnglishBlock from "@/app/[locale]/admin/EnglishBlock";

import { partnerTypes } from "@/lib/partenaires";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

// Libellés FR des types (le back-office est en français ; le site public traduit).
const typeLabels: Record<(typeof partnerTypes)[number], string> = {
  sponsor: "Sponsor",
  partenaire: "Partenaire",
};

export type PartnerRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  description_en: string | null;
  logo: string | null;
  url: string | null;
  position: number;
  active: boolean;
};

export default function PartnerForm({
  action,
  partner,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  partner?: PartnerRow;
  submitLabel: string;
}) {
  // Préfixe d'id unique par instance (une même page affiche plusieurs formulaires).
  const uid = partner ? `partner-${partner.id}` : "partner-new";
  const hasEnglish = Boolean(partner?.description_en);

  return (
    <AdminForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {partner && <input type="hidden" name="id" value={partner.id} />}

      <div className="block">
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Nom
        </label>
        <input
          id={`${uid}-name`}
          name="name"
          defaultValue={partner?.name}
          required
          placeholder="Nom du partenaire"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-type`} className={labelCls}>
          Type
        </label>
        <select
          id={`${uid}-type`}
          name="type"
          defaultValue={partner?.type ?? "partenaire"}
          className={inputCls}
        >
          {partnerTypes.map((tp) => (
            <option key={tp} value={tp}>
              {typeLabels[tp]}
            </option>
          ))}
        </select>
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-logo-file`} className={labelCls}>
          Logo
        </label>
        <div className="flex items-center gap-3">
          {partner?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={partner.logo}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg bg-white/90 object-contain p-1"
            />
          )}
          <input
            id={`${uid}-logo-file`}
            name="logo_file"
            type="file"
            accept="image/*"
            className="w-full text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-xbz-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>
        <label htmlFor={`${uid}-logo-url`} className="sr-only">
          URL du logo
        </label>
        <input
          id={`${uid}-logo-url`}
          name="logo_url"
          type="url"
          defaultValue={partner?.logo ?? ""}
          placeholder="…ou colle une URL de logo"
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Upload un logo (JPG / PNG / WebP, 5&nbsp;Mo max) ou colle une URL. L&apos;upload est
          prioritaire, recommandé (optimisé et servi depuis le site).
        </p>
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-url`} className={labelCls}>
          Lien vers le site du partenaire
        </label>
        <input
          id={`${uid}-url`}
          name="url"
          type="url"
          defaultValue={partner?.url ?? ""}
          placeholder="https://partenaire.com"
          className={inputCls}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-description`} className={labelCls}>
          Mention (facultatif)
        </label>
        <input
          id={`${uid}-description`}
          name="description"
          defaultValue={partner?.description ?? ""}
          placeholder="Équipementier officiel"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input
          id={`${uid}-position`}
          name="position"
          type="number"
          defaultValue={partner?.position ?? 0}
          className={inputCls}
        />
      </div>

      <div className="flex items-end gap-2 text-sm text-neutral-300">
        <input
          id={`${uid}-active`}
          type="checkbox"
          name="active"
          defaultChecked={partner?.active ?? true}
          className="h-4 w-4"
        />
        <label htmlFor={`${uid}-active`} className="pb-2">
          Visible sur le site
        </label>
      </div>

      <EnglishBlock filled={hasEnglish}>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-description-en`} className={labelCls}>
            Mention (EN)
          </label>
          <input
            id={`${uid}-description-en`}
            name="description_en"
            defaultValue={partner?.description_en ?? ""}
            placeholder="Official kit supplier"
            className={inputCls}
          />
        </div>
      </EnglishBlock>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </AdminForm>
  );
}
