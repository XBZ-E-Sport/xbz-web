// Couche d'accès à la boutique.
// Source : table Supabase `products` (lecture publique des produits actifs,
// via RLS `active = true`). Les pages consomment ces fonctions sans savoir
// d'où viennent les données.
//
// Achat via lien externe (champ `url`) — AUCUN paiement géré sur le site.

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import { localizedText } from "@/lib/localized";

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

const PRODUCT_COLS =
  "slug, name, name_en, description, description_en, price, category, icon, image, url, available";

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
  url: string | null;
  available: boolean | null;
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
    url: row.url ?? null,
  };
}

/** Lecture brute, bilingue, mise en cache (une entrée sert les deux langues). */
const fetchProducts = unstable_cache(
  async (): Promise<ProductRow[]> => {
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
    return (data ?? []) as ProductRow[];
  },
  ["products-list"],
  { tags: [CACHE_TAGS.products], revalidate: CACHE_TTL_SECONDS },
);

/** Liste des produits actifs, ordonnés pour l'affichage, dans `locale`. */
export async function getProducts(locale: string): Promise<Product[]> {
  return (await fetchProducts()).map((row) => toProduct(row, locale));
}
