import AdminForm from "@/components/AdminForm";
import ConfirmButton from "@/components/ConfirmButton";
import { MAX_EXTRA_PHOTOS } from "@/lib/boutique";
import { UPLOAD_MAX_BYTES, formatMegabytes } from "@/lib/limits";
import { addProductPhoto, removeProductPhoto, setMainProductPhoto } from "./actions";
import type { ProductRow } from "./ProductForm";

const btn = "rounded-md px-2 py-1 text-xs font-semibold transition hover:cursor-pointer";

/**
 * Photos supplémentaires d'un produit (page produit), APRÈS la principale.
 * Une photo par envoi : le corps d'une requête est plafonné à 4,5 Mo.
 */
export default function ProductPhotos({ product }: { product: ProductRow }) {
  const full = product.images.length >= MAX_EXTRA_PHOTOS;
  return (
    <section aria-label={`Photos supplémentaires de ${product.name}`} className="mt-6 border-t border-white/10 pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Photos supplémentaires ({product.images.length}/{MAX_EXTRA_PHOTOS})
      </h4>
      <p className="mt-1 text-xs text-neutral-400">
        Affichées sur la page du produit, après la photo principale (le « Visuel produit » ci-dessus).
      </p>

      {product.images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
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
                <button className={`${btn} w-full bg-white/5 text-neutral-200 hover:bg-white/10`}>Principale</button>
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
      )}

      {full ? (
        <p className="mt-3 text-sm text-neutral-400">Maximum atteint : retire une photo pour en ajouter une autre.</p>
      ) : (
        <AdminForm
          action={addProductPhoto}
          closeOnSuccess={false}
          className="mt-3 flex flex-wrap items-center gap-3"
          loadingMessage="Envoi de la photo…"
          successMessage="Photo ajoutée"
        >
          <input type="hidden" name="id" value={product.id} />
          <label htmlFor={`photo-${product.id}`} className="sr-only">
            Photo à ajouter à {product.name}
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
