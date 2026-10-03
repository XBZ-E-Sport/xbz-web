import AdminForm from "@/components/AdminForm";
import ConfirmButton from "@/components/ConfirmButton";
import { MAX_EXTRA_PHOTOS } from "@/lib/boutique";
import { UPLOAD_MAX_BYTES, formatMegabytes } from "@/lib/limits";
import { addProductPhoto, removeProductPhoto, setMainProductPhoto } from "./actions";
import type { ProductRow } from "./ProductForm";

const btn = "rounded-md px-2 py-1 text-xs font-semibold transition hover:cursor-pointer";

/**
 * Photos d'un produit, EN TÊTE de la fiche : la principale, puis les
 * supplémentaires (page produit) avec leurs actions, puis l'ajout.
 * Une photo par envoi : le corps d'une requête est plafonné à 4,5 Mo.
 *
 * Ces formulaires sont indépendants de celui du produit (un `<form>` ne peut
 * pas en contenir un autre) : changer la photo principale d'ici n'attend pas
 * l'enregistrement du reste, et le formulaire du produit ne la réécrit pas
 * (voir `image_orig` dans actions.ts).
 */
export default function ProductPhotos({ product }: { product: ProductRow }) {
  const full = product.images.length >= MAX_EXTRA_PHOTOS;
  const titleId = `photos-${product.id}`;
  return (
    <section aria-labelledby={titleId} className="mb-6 border-b border-white/10 pb-5">
      <h4 id={titleId} className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Photos
      </h4>
      <p className="mt-1 text-xs text-neutral-400">
        La photo principale s’affiche en premier sur la page du produit, suivie des photos supplémentaires (jusqu’à{" "}
        {MAX_EXTRA_PHOTOS}). Pour remplacer la principale par un nouveau fichier, utilise « Visuel produit » plus bas.
      </p>

      <ul className="mt-3 flex flex-wrap gap-3">
        <li className="flex w-28 flex-col gap-1.5">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu du back-office
            <img src={product.image} alt="Photo principale" className="h-28 w-28 rounded-lg object-cover" />
          ) : (
            <span className="flex h-28 w-28 items-center justify-center rounded-lg bg-white/5 text-center text-xs text-neutral-400">
              Pas de photo : l’emoji est affiché
            </span>
          )}
          <span className="rounded-md bg-xbz-cyan/15 px-2 py-1 text-center text-xs font-semibold text-xbz-cyan">
            Principale
          </span>
        </li>
        {product.images.map((url, i) => (
          <li key={url} className="flex w-28 flex-col gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu du back-office */}
            <img src={url} alt={`Photo supplémentaire ${i + 1}`} className="h-28 w-28 rounded-lg object-cover" />
            <AdminForm
              action={setMainProductPhoto}
              closeOnSuccess={false}
              loadingMessage="Changement de photo principale…"
              successMessage="Photo principale changée"
            >
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="url" value={url} />
              <button className={`${btn} w-full bg-white/5 text-neutral-200 hover:bg-white/10`}>En principale</button>
            </AdminForm>
            <AdminForm
              action={removeProductPhoto}
              closeOnSuccess={false}
              loadingMessage="Retrait de la photo…"
              successMessage="Photo retirée"
            >
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="url" value={url} />
              <ConfirmButton
                className={`${btn} w-full bg-red-500/15 text-red-300 hover:bg-red-500/25`}
                message="Retirer cette photo de la page produit ?"
              >
                Retirer
              </ConfirmButton>
            </AdminForm>
          </li>
        ))}
      </ul>

      {full ? (
        <p className="mt-3 text-sm text-neutral-400">
          Maximum atteint ({product.images.length}/{MAX_EXTRA_PHOTOS}) : retire une photo pour en ajouter une autre.
        </p>
      ) : (
        <AdminForm
          action={addProductPhoto}
          closeOnSuccess={false}
          className="mt-3 flex flex-wrap items-center gap-3"
          loadingMessage="Envoi de la photo…"
          successMessage="Photo ajoutée"
        >
          <input type="hidden" name="id" value={product.id} />
          <label htmlFor={`photo-${product.id}`} className="text-sm font-semibold text-neutral-200">
            Ajouter une photo supplémentaire ({product.images.length}/{MAX_EXTRA_PHOTOS})
          </label>
          <input
            id={`photo-${product.id}`}
            name="photo_file"
            type="file"
            accept="image/*"
            required
            className="text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
          />
          <button className={`${btn} bg-xbz-blue px-4 py-2 text-sm text-white hover:brightness-110`}>Ajouter la photo</button>
          <span className="text-xs text-neutral-400">
            Une photo à la fois, {formatMegabytes(UPLOAD_MAX_BYTES)} max.
          </span>
        </AdminForm>
      )}
    </section>
  );
}
