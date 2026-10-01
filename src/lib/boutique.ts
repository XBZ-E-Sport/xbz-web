// Couche d'accès à la boutique.
// Source : tables Supabase `products` et `product_variants` (lecture publique
// des produits actifs et de leurs tailles, via RLS). Les pages consomment ces
// fonctions sans savoir d'où viennent les données.
//
// Paiement sur le site (Stripe Checkout) : voir src/lib/shop.ts. Ici, on ne
// fait que LIRE le catalogue — prix et stock affichés. Le prix réellement
// payé est recalculé en base au moment de payer, jamais repris d'ici.

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import { localizedText } from "@/lib/localized";

export type ProductCategory = "Textile" | "Accessoire" | "Gaming";

export const productCategories: ProductCategory[] = ["Textile", "Accessoire", "Gaming"];

/** Une taille proposée. `size === ""` : taille unique. */
export type ProductVariant = {
  id: string;
  size: string;
  stock: number;
};

export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number; // en euros
  category: ProductCategory;
  icon: string; // emoji de repli si pas d'image
  image: string | null; // URL (Supabase Storage)
  available: boolean; // true → en vente (sinon « bientôt disponible »)
  variants: ProductVariant[]; // tailles, dans l'ordre du back-office
};

/** En vente ET au moins une taille en stock. */
export function isPurchasable(product: Pick<Product, "available" | "variants">): boolean {
  return product.available && product.variants.some((v) => v.stock > 0);
}

/** Taille unique (pas de choix à proposer) : une seule variante, sans nom. */
export function isSingleSize(product: Pick<Product, "variants">): boolean {
  return product.variants.length === 1 && product.variants[0].size === "";
}

const PRODUCT_COLS =
  "slug, name, name_en, description, description_en, price, category, icon, image, available, " +
  "variants:product_variants(id, size, stock, position)";

/** Normalise une catégorie inconnue vers "Textile" (garde-fou d'affichage). */
function normalizeCategory(value: string): ProductCategory {
  return (productCategories as string[]).includes(value)
    ? (value as ProductCategory)
    : "Textile";
}

type ProductRow = {
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | string | null; // `numeric` peut revenir en string
  category: string;
  icon: string | null;
  image: string | null;
  available: boolean | null;
  variants: { id: string; size: string | null; stock: number | null; position: number | null }[] | null;
};

/** Ligne brute → produit dans UNE langue (résolution hors cache, cf. actualite.ts). */
function toProduct(row: ProductRow, locale: string): Product {
  return {
    slug: row.slug,
    name: localizedText(row.name, row.name_en, locale) ?? row.name,
    description: localizedText(row.description, row.description_en, locale) ?? "",
    price: Number(row.price ?? 0),
    category: normalizeCategory(row.category),
    icon: row.icon ?? "",
    image: row.image ?? null,
    available: Boolean(row.available),
    variants: (row.variants ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((v) => ({ id: v.id, size: v.size ?? "", stock: Math.max(0, Number(v.stock ?? 0)) })),
  };
}

/** Lecture brute, bilingue, mise en cache (une entrée sert les deux langues). */
const fetchProducts = unstable_cache(
  async (): Promise<ProductRow[]> => {
    const supabase = createPublicClient();
    const query = (cols: string) =>
      supabase
        .from("products")
        .select(cols)
        .eq("active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

    const { data, error } = await query(PRODUCT_COLS);
    if (!error) return (data ?? []) as unknown as ProductRow[];

    // Table des tailles absente (code déployé AVANT la migration boutique) :
    // le catalogue reste affiché, rien n'est en vente. Mieux qu'une boutique vide.
    console.error("[boutique] select:", error.message);
    const fallback = await query(PRODUCT_COLS.replace(/, variants:.*$/, ""));
    if (fallback.error) {
      console.error("[boutique] select (sans tailles):", fallback.error.message);
      return [];
    }
    return ((fallback.data ?? []) as unknown as ProductRow[]).map((row) => ({ ...row, variants: [] }));
  },
  ["products-list"],
  { tags: [CACHE_TAGS.products], revalidate: CACHE_TTL_SECONDS },
);

/** Liste des produits actifs, ordonnés pour l'affichage, dans `locale`. */
export async function getProducts(locale: string): Promise<Product[]> {
  return (await fetchProducts()).map((row) => toProduct(row, locale));
}
