import { productCategories } from "@/lib/boutique";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number | string | null;
  category: string;
  icon: string | null;
  image: string | null;
  url: string | null;
  available: boolean;
  position: number;
  active: boolean;
};

export default function ProductForm({
  action,
  product,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  product?: ProductRow;
  submitLabel: string;
}) {
  // Préfixe d'id unique par instance (une même page affiche plusieurs formulaires).
  const uid = product ? `product-${product.id}` : "product-new";

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Nom
        </label>
        <input
          id={`${uid}-name`}
          name="name"
          defaultValue={product?.name}
          required
          placeholder="Maillot officiel XBZ"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={product?.slug} placeholder="maillot-officiel" className={inputCls} />
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
          placeholder="49.99"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-icon`} className={labelCls}>
          Emoji de repli (si pas d’image)
        </label>
        <input id={`${uid}-icon`} name="icon" defaultValue={product?.icon ?? ""} placeholder="👕" className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-image-file`} className={labelCls}>
          Visuel produit
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
          Upload une image (JPG / PNG / WebP, 5&nbsp;Mo max) ou colle une URL. L&apos;upload est
          prioritaire sur l&apos;URL.
        </p>
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-url`} className={labelCls}>
          Lien d’achat externe
        </label>
        <input
          id={`${uid}-url`}
          name="url"
          type="url"
          defaultValue={product?.url ?? ""}
          placeholder="https://boutique-externe.com/produit-xbz"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Lien vers un shop externe. Laissé vide, un produit « achetable » affiche un bouton
          « Commander » qui renvoie vers le Discord.
        </p>
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-description`} className={labelCls}>
          Description
        </label>
        <textarea
          id={`${uid}-description`}
          name="description"
          defaultValue={product?.description ?? ""}
          rows={2}
          placeholder="Le maillot compétitif aux couleurs de la structure."
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input id={`${uid}-position`} name="position" type="number" defaultValue={product?.position ?? 0} className={inputCls} />
      </div>

      <div className="flex flex-col justify-end gap-2 text-sm text-neutral-300">
        <div className="flex items-center gap-2">
          <input id={`${uid}-available`} type="checkbox" name="available" defaultChecked={product?.available ?? false} className="h-4 w-4" />
          <label htmlFor={`${uid}-available`}>Achetable (affiche un bouton d’achat)</label>
        </div>
        <div className="flex items-center gap-2">
          <input id={`${uid}-active`} type="checkbox" name="active" defaultChecked={product?.active ?? true} className="h-4 w-4" />
          <label htmlFor={`${uid}-active`}>Visible sur le site</label>
        </div>
      </div>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
