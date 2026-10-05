import AdminForm from "@/components/AdminForm";
import EnglishBlock from "@/app/[locale]/admin/EnglishBlock";

import { productCategories } from "@/lib/boutique";
import { UPLOAD_MAX_BYTES, formatMegabytes } from "@/lib/limits";
import VariantsEditor, { type VariantRow } from "./VariantsEditor";
import type { AdminAction } from "@/lib/admin-result";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | string | null;
  category: string;
  icon: string | null;
  image: string | null;
  available: boolean;
  position: number;
  active: boolean;
  variants: VariantRow[];
  /** Photos supplémentaires (page produit), après la principale (`image`). */
  images: string[];
  size_guide: string | null;
  size_guide_en: string | null;
  /** Personnalisation nom / numéro proposée (absent tant que la migration n'est pas passée). */
  personalizable?: boolean;
  personalization_price?: number | string | null;
};

export default function ProductForm({
  action,
  product,
  submitLabel,
  sizeGuide = false,
  personalization = false,
}: {
  action: AdminAction;
  product?: ProductRow;
  submitLabel: string;
  /** Champs « guide des tailles » (colonnes présentes en base). */
  sizeGuide?: boolean;
  /** Réglage « personnalisation » (colonnes présentes en base). */
  personalization?: boolean;
}) {
  // Préfixe d'id unique par instance (une même page affiche plusieurs formulaires).
  const uid = product ? `product-${product.id}` : "product-new";
  const hasEnglish = Boolean(product?.name_en || product?.description_en || product?.size_guide_en);

  return (
    <AdminForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      {/* Photo principale telle qu'affichée au chargement : l'action ne la
          réécrit que si ce champ change — voir buildRow (actions.ts). */}
      {product && <input type="hidden" name="image_orig" value={product.image ?? ""} />}

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Nom
        </label>
        <input
          id={`${uid}-name`}
          name="name"
          defaultValue={product?.name}
          required
          placeholder="ex. Maillot officiel XBZ"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={product?.slug} placeholder="ex. maillot-officiel" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-category`} className={labelCls}>
          Catégorie
        </label>
        <select id={`${uid}-category`} name="category" defaultValue={product?.category ?? "Textile"} className={inputCls}>
          {productCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-price`} className={labelCls}>
          Prix (€)
        </label>
        <input
          id={`${uid}-price`}
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={product ? String(product.price ?? "") : ""}
          placeholder="ex. 49.99"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-icon`} className={labelCls}>
          Emoji de repli (si pas d’image)
        </label>
        <input id={`${uid}-icon`} name="icon" defaultValue={product?.icon ?? ""} placeholder="ex. 👕" className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-image-file`} className={labelCls}>
          Visuel produit (photo principale)
        </label>
        <div className="flex items-center gap-3">
          {product?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          )}
          <input
            id={`${uid}-image-file`}
            name="image_file"
            type="file"
            accept="image/*"
            className="w-full text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-xbz-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>
        <label htmlFor={`${uid}-image-url`} className="sr-only">
          URL de l’image
        </label>
        <input
          id={`${uid}-image-url`}
          name="image_url"
          type="url"
          defaultValue={product?.image ?? ""}
          placeholder="…ou colle une URL d'image"
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Upload une image (JPG / PNG / WebP, {formatMegabytes(UPLOAD_MAX_BYTES)} max) ou colle une URL. L&apos;upload est
          prioritaire sur l&apos;URL.
        </p>
      </div>

      {/* Remonté après chaque enregistrement (clé) : les tailles créées
          reçoivent leur identifiant, le formulaire repart de la base. */}
      <VariantsEditor
        key={JSON.stringify(product?.variants ?? [])}
        uid={uid}
        variants={product?.variants ?? []}
      />

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-description`} className={labelCls}>
          Description
        </label>
        <textarea
          id={`${uid}-description`}
          name="description"
          defaultValue={product?.description ?? ""}
          rows={2}
          placeholder="ex. Le maillot compétitif aux couleurs de la structure."
          className={inputCls}
        />
      </div>

      {sizeGuide && (
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-size-guide`} className={labelCls}>
            Guide des tailles (facultatif, affiché sur la page produit)
          </label>
          <textarea
            id={`${uid}-size-guide`}
            name="size_guide"
            defaultValue={product?.size_guide ?? ""}
            rows={3}
            maxLength={4000}
            placeholder={"ex.\nS : 50 cm de large, 70 cm de long\nM : 53 × 72 cm\nCoupe ajustée : prends ta taille habituelle."}
            className={inputCls}
          />
        </div>
      )}

      {personalization && (
        <fieldset className="rounded-lg border border-white/10 p-3 sm:col-span-2">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Personnalisation nom et numéro
          </legend>
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              id={`${uid}-personalizable`}
              type="checkbox"
              name="personalizable"
              defaultChecked={product?.personalizable ?? false}
              className="h-4 w-4"
            />
            <label htmlFor={`${uid}-personalizable`}>Proposer la personnalisation sur ce produit</label>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Interrupteur : à décocher pour retirer la personnalisation du site sans rien supprimer (les articles déjà
            commandés ne changent pas). À activer seulement quand l’atelier peut la produire. Le client est prévenu qu’un
            article personnalisé est exclu du droit de rétractation.
          </p>
          <div className="mt-3 max-w-xs">
            <label htmlFor={`${uid}-personalization-price`} className={labelCls}>
              Supplément par pièce personnalisée (€ TTC)
            </label>
            <input
              id={`${uid}-personalization-price`}
              name="personalization_price"
              type="text"
              inputMode="decimal"
              defaultValue={String(Number(product?.personalization_price ?? 0)).replace(".", ",")}
              placeholder="ex. 5"
              className={inputCls}
            />
          </div>
        </fieldset>
      )}

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input id={`${uid}-position`} name="position" type="number" defaultValue={product?.position ?? 0} className={inputCls} />
      </div>

      <div className="flex flex-col justify-end gap-2 text-sm text-neutral-300">
        <div className="flex items-center gap-2">
          <input id={`${uid}-available`} type="checkbox" name="available" defaultChecked={product?.available ?? false} className="h-4 w-4" />
          <label htmlFor={`${uid}-available`}>En vente (paiement en ligne)</label>
        </div>
        <div className="flex items-center gap-2">
          <input id={`${uid}-active`} type="checkbox" name="active" defaultChecked={product?.active ?? true} className="h-4 w-4" />
          <label htmlFor={`${uid}-active`}>Visible sur le site</label>
        </div>
      </div>

      <EnglishBlock filled={hasEnglish}>
        <div className="block">
          <label htmlFor={`${uid}-name-en`} className={labelCls}>
            Name
          </label>
          <input
            id={`${uid}-name-en`}
            name="name_en"
            defaultValue={product?.name_en ?? ""}
            placeholder="ex. XBZ mouse pad"
            className={inputCls}
          />
        </div>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-description-en`} className={labelCls}>
            Description
          </label>
          <textarea
            id={`${uid}-description-en`}
            name="description_en"
            defaultValue={product?.description_en ?? ""}
            rows={2}
            className={inputCls}
          />
        </div>
        {sizeGuide && (
          <div className="block sm:col-span-2">
            <label htmlFor={`${uid}-size-guide-en`} className={labelCls}>
              Size guide
            </label>
            <textarea
              id={`${uid}-size-guide-en`}
              name="size_guide_en"
              defaultValue={product?.size_guide_en ?? ""}
              rows={3}
              maxLength={4000}
              className={inputCls}
            />
          </div>
        )}
      </EnglishBlock>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </AdminForm>
  );
}
