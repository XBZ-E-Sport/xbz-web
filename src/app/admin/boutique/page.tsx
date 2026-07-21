import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmButton from "@/components/ConfirmButton";
import ProductForm, { type ProductRow } from "./ProductForm";
import { createProduct, updateProduct, deleteProduct } from "./actions";

export const metadata = { title: "Boutique — Back-office XBZ" };
export const dynamic = "force-dynamic";

const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function AdminBoutiquePage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, slug, name, description, price, category, icon, image, url, available, position, active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const products = (data ?? []) as ProductRow[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un produit */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouveau produit</h2>
        <ProductForm action={createProduct} submitLabel="Ajouter le produit" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Produits <span className="text-neutral-500">({products.length})</span>
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
                    <p className="text-sm text-neutral-500">
                      /{p.slug} · {p.category} · {priceFormatter.format(Number(p.price ?? 0))}
                    </p>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / Supprimer
                  </summary>
                  <div className="mt-4">
                    <ProductForm action={updateProduct} product={p} submitLabel="Enregistrer" />
                    <form action={deleteProduct} className="mt-3">
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                        message={`Supprimer le produit "${p.name}" ? Action irréversible.`}
                      >
                        Supprimer le produit
                      </ConfirmButton>
                    </form>
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
