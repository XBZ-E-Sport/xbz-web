// Couche d'accès à la boutique.
// Source : table Supabase `products` (lecture publique des produits actifs,
// via RLS `active = true`). Les pages consomment ces fonctions sans savoir
// d'où viennent les données.
//
// Achat via lien externe (champ `url`) — AUCUN paiement géré sur le site.

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";

export type ProductCategory = "Textile" | "Accessoire" | "Gaming";

export const productCategories: ProductCategory[] = ["Textile", "Accessoire", "Gaming"];

export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number; // en euros
  category: ProductCategory;
  icon: string; // emoji de repli si pas d'image
  image: string | null; // URL (Supabase Storage)
  available: boolean; // true → bouton "Acheter" (nécessite `url`)
  url: string | null; // lien d'achat externe
};

const PRODUCT_COLS = "slug, name, description, price, category, icon, image, url, available";

/** Normalise une catégorie inconnue vers "Textile" (garde-fou d'affichage). */
function normalizeCategory(value: string): ProductCategory {
  return (productCategories as string[]).includes(value)
    ? (value as ProductCategory)
    : "Textile";
}

type ProductRow = {
  slug: string;
  name: string;
  description: string | null;
  price: number | string | null; // `numeric` peut revenir en string
  category: string;
  icon: string | null;
  image: string | null;
  url: string | null;
  available: boolean | null;
};

function toProduct(row: ProductRow): Product {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price ?? 0),
    category: normalizeCategory(row.category),
    icon: row.icon ?? "",
    image: row.image ?? null,
    available: Boolean(row.available),
    url: row.url ?? null,
  };
}

/** Liste des produits actifs, ordonnés pour l'affichage. Cache : tag `products`. */
export const getProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[boutique] select:", error.message);
      return [];
    }
    return ((data ?? []) as ProductRow[]).map(toProduct);
  },
  ["products-list"],
  { tags: [CACHE_TAGS.products], revalidate: CACHE_TTL_SECONDS },
);
