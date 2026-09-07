import AdminForm from "@/components/AdminForm";
import EnglishBlock from "@/app/[locale]/admin/EnglishBlock";
import { employmentTypes, salaryPeriods } from "@/lib/offres";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

// Libellés FR du back-office (le site public, lui, traduit via les messages).
const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Temps plein",
  PART_TIME: "Temps partiel",
  CONTRACTOR: "Prestation / freelance",
  TEMPORARY: "CDD / intérim",
  INTERN: "Stage / alternance",
  VOLUNTEER: "Bénévolat",
};
const PERIOD_LABELS: Record<string, string> = {
  HOUR: "par heure",
  MONTH: "par mois",
  YEAR: "par an",
};

export type OfferRow = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
  excerpt_en: string | null;
  description: string[] | null;
  description_en: string[] | null;
  department: string | null;
  department_en: string | null;
  employment_type: string;
  remote: boolean;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  salary_min: number | string | null;
  salary_max: number | string | null;
  salary_period: string;
  date_posted: string; // YYYY-MM-DD
  valid_through: string | null;
  apply_url: string | null;
  active: boolean;
  position: number;
};

export default function OfferForm({
  action,
  offer,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  offer?: OfferRow;
  submitLabel: string;
}) {
  const uid = offer ? `offer-${offer.id}` : "offer-new";
  const hasEnglish = Boolean(
    offer?.title_en || offer?.excerpt_en || offer?.description_en?.length || offer?.department_en,
  );

  return (
    <AdminForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {offer && <input type="hidden" name="id" value={offer.id} />}

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-title`} className={labelCls}>
          Intitulé du poste
        </label>
        <input
          id={`${uid}-title`}
          name="title"
          defaultValue={offer?.title}
          required
          placeholder="Développeur web (H/F)"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={offer?.slug} placeholder="developpeur-web" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-department`} className={labelCls}>
          Service / pôle
        </label>
        <input id={`${uid}-department`} name="department" defaultValue={offer?.department ?? ""} placeholder="Développement" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-employment`} className={labelCls}>
          Type de contrat
        </label>
        <select id={`${uid}-employment`} name="employment_type" defaultValue={offer?.employment_type ?? "FULL_TIME"} className={inputCls}>
          {employmentTypes.map((e) => (
            <option key={e} value={e}>
              {EMPLOYMENT_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <input id={`${uid}-remote`} type="checkbox" name="remote" defaultChecked={offer?.remote ?? false} className="h-4 w-4" />
        <label htmlFor={`${uid}-remote`}>Télétravail (sinon, ville obligatoire)</label>
      </div>

      {/* Localisation */}
      <div className="block">
        <label htmlFor={`${uid}-city`} className={labelCls}>
          Ville
        </label>
        <input id={`${uid}-city`} name="city" defaultValue={offer?.city ?? ""} placeholder="Lyon" className={inputCls} />
      </div>
      <div className="block">
        <label htmlFor={`${uid}-region`} className={labelCls}>
          Région
        </label>
        <input id={`${uid}-region`} name="region" defaultValue={offer?.region ?? ""} placeholder="Auvergne-Rhône-Alpes" className={inputCls} />
      </div>
      <div className="block">
        <label htmlFor={`${uid}-postal`} className={labelCls}>
          Code postal
        </label>
        <input id={`${uid}-postal`} name="postal_code" defaultValue={offer?.postal_code ?? ""} placeholder="69000" className={inputCls} />
      </div>
      <div className="block">
        <label htmlFor={`${uid}-country`} className={labelCls}>
          Pays (code ISO)
        </label>
        <input id={`${uid}-country`} name="country" defaultValue={offer?.country ?? "FR"} placeholder="FR" maxLength={2} className={inputCls} />
      </div>

      {/* Salaire (facultatif) */}
      <div className="block">
        <label htmlFor={`${uid}-salmin`} className={labelCls}>
          Salaire min (€)
        </label>
        <input id={`${uid}-salmin`} name="salary_min" type="number" min={0} step="0.01" defaultValue={offer?.salary_min ?? ""} placeholder="2000" className={inputCls} />
      </div>
      <div className="block">
        <label htmlFor={`${uid}-salmax`} className={labelCls}>
          Salaire max (€)
        </label>
        <input id={`${uid}-salmax`} name="salary_max" type="number" min={0} step="0.01" defaultValue={offer?.salary_max ?? ""} placeholder="2500" className={inputCls} />
      </div>
      <div className="block">
        <label htmlFor={`${uid}-period`} className={labelCls}>
          Période
        </label>
        <select id={`${uid}-period`} name="salary_period" defaultValue={offer?.salary_period ?? "MONTH"} className={inputCls}>
          {salaryPeriods.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Ordre d’affichage
        </label>
        <input id={`${uid}-position`} name="position" type="number" defaultValue={offer?.position ?? 0} className={inputCls} />
      </div>

      {/* Dates */}
      <div className="block">
        <label htmlFor={`${uid}-posted`} className={labelCls}>
          Date de publication
        </label>
        <input id={`${uid}-posted`} name="date_posted" type="date" defaultValue={offer?.date_posted ?? ""} className={inputCls} />
      </div>
      <div className="block">
        <label htmlFor={`${uid}-valid`} className={labelCls}>
          Valable jusqu’au (recommandé)
        </label>
        <input id={`${uid}-valid`} name="valid_through" type="date" defaultValue={offer?.valid_through ?? ""} className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-apply`} className={labelCls}>
          Lien pour postuler (URL ou mailto: — vide = formulaire de recrutement)
        </label>
        <input id={`${uid}-apply`} name="apply_url" defaultValue={offer?.apply_url ?? ""} placeholder="mailto:recrutement@xbz.gg" className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-excerpt`} className={labelCls}>
          Résumé (carte de liste + meta description)
        </label>
        <textarea id={`${uid}-excerpt`} name="excerpt" defaultValue={offer?.excerpt ?? ""} rows={2} placeholder="Une phrase d'accroche." className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-description`} className={labelCls}>
          Description (un paragraphe par bloc, séparés par une ligne vide)
        </label>
        <textarea id={`${uid}-description`} name="description" defaultValue={(offer?.description ?? []).join("\n\n")} rows={10} placeholder={"Missions…\n\nProfil recherché…"} className={inputCls} />
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <input id={`${uid}-active`} type="checkbox" name="active" defaultChecked={offer?.active ?? true} className="h-4 w-4" />
        <label htmlFor={`${uid}-active`}>En ligne (visible et crawlable)</label>
      </div>

      <EnglishBlock filled={hasEnglish}>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-title-en`} className={labelCls}>
            Job title
          </label>
          <input id={`${uid}-title-en`} name="title_en" defaultValue={offer?.title_en ?? ""} placeholder="Web developer (M/F)" className={inputCls} />
        </div>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-department-en`} className={labelCls}>
            Department
          </label>
          <input id={`${uid}-department-en`} name="department_en" defaultValue={offer?.department_en ?? ""} placeholder="Development" className={inputCls} />
        </div>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-excerpt-en`} className={labelCls}>
            Summary
          </label>
          <textarea id={`${uid}-excerpt-en`} name="excerpt_en" defaultValue={offer?.excerpt_en ?? ""} rows={2} className={inputCls} />
        </div>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-description-en`} className={labelCls}>
            Description (one paragraph per block)
          </label>
          <textarea id={`${uid}-description-en`} name="description_en" defaultValue={(offer?.description_en ?? []).join("\n\n")} rows={10} className={inputCls} />
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
