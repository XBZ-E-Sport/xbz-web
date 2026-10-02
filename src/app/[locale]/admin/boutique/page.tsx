import AdminForm from "@/components/AdminForm";
import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import ProductForm, { type ProductRow } from "./ProductForm";
import ProductPhotos from "./ProductPhotos";
import { createProduct, updateProduct, deleteProduct } from "./actions";

export const metadata = { title: "Boutique — Back-office XBZ" };
export const dynamic = "force-dynamic";

const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function AdminBoutiquePage() {
  // Contrôle d'accès DANS la page : layout et page sont rendus EN PARALLÈLE
  // par le App Router. Une garde placée uniquement dans le layout laisse la
  // page interroger la base et sérialiser ses données dans la réponse, même
  // quand la redirection part. La garde doit donc vivre ici aussi.
  const { admin } = await requireStaff();
  const base =
    "id, slug, name, name_en, description, description_en, price, category, icon, image, available, position, active, " +
    "variants:product_variants(id, size, stock, position)";
  const select = (cols: string) =>
    admin.from("products").select(cols).order("position", { ascending: true }).order("created_at", { ascending: true });

  // Photos supplémentaires et guide des tailles : seulement une fois la
  // migration des pages produit passée. Avant, la page reste utilisable.
  let pageColumns = true;
  let { data, error } = await select(`${base}, images, size_guide, size_guide_en`);
  if (error?.code === "42703") {
    pageColumns = false;
    ({ data, error } = await select(base));
  }

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  type Raw = Omit<ProductRow, "variants" | "images" | "size_guide" | "size_guide_en"> & {
    variants: { id: string; size: string; stock: number; position: number }[] | null;
    images?: string[] | null;
    size_guide?: string | null;
    size_guide_en?: string | null;
  };
  const products: ProductRow[] = ((data ?? []) as unknown as Raw[]).map((p) => ({
    ...p,
    images: p.images ?? [],
    size_guide: p.size_guide ?? null,
    size_guide_en: p.size_guide_en ?? null,
    variants: (p.variants ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(({ id, size, stock }) => ({ id, size, stock })),
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un produit */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouveau produit</h2>
        <ProductForm action={createProduct} submitLabel="Ajouter le produit" sizeGuide={pageColumns} />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Produits <span className="text-neutral-400">({products.length})</span>
        </h2>

        {products.length === 0 ? (
          <p className="text-neutral-400">Aucun produit. Crée le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {products.map((p) => (
              <li key={p.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg text-white">
                      <span aria-hidden="true" className="mr-2">
                        {p.icon || "🛒"}
                      </span>
                      {p.name}
                      {!p.active && (
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                          masqué
                        </span>
                      )}
                      {p.active && !p.available && (
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                          bientôt
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-neutral-400">
                      /{p.slug} · {p.category} · {priceFormatter.format(Number(p.price ?? 0))}
                    </p>
                    <p className="mt-1 text-sm text-neutral-300">
                      Stock :{" "}
                      {p.variants.length === 0
                        ? "aucune taille"
                        : p.variants.map((v) => `${v.size || "unique"} ${v.stock}`).join(" · ")}
                      {p.active && p.available && p.variants.every((v) => v.stock <= 0) && (
                        <span className="ml-2 rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">rupture</span>
                      )}
                    </p>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / Supprimer
                  </summary>
                  <div className="mt-4">
                    <ProductForm action={updateProduct} product={p} submitLabel="Enregistrer" sizeGuide={pageColumns} />
                    {pageColumns ? (
                      <ProductPhotos product={p} />
                    ) : (
                      <p className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-neutral-400">
                        Photos supplémentaires et guide des tailles : exécute la migration
                        « migration_pages_produit_02102026.sql » dans Supabase pour les activer.
                      </p>
                    )}
                    <AdminForm
                      action={deleteProduct}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Produit supprimé"
                      closeOnSuccess={false}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                        message={`Supprimer le produit "${p.name}" ? Action irréversible.`}
                      >
                        Supprimer le produit
                      </ConfirmButton>
                    </AdminForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
