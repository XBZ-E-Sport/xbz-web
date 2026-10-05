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

/** Photos supplémentaires au plus par produit (même borne que la contrainte en base). */
export const MAX_EXTRA_PHOTOS = 8;
/** Supplément de personnalisation maximal, en euros (même borne qu'en base). */
export const MAX_PERSONALIZATION_PRICE = 100;
/** Longueur maximale du guide des tailles, par langue (même borne qu'en base). */
export const SIZE_GUIDE_MAX = 4000;

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
  image: string | null; // photo principale, URL (Supabase Storage)
  /** Toutes les photos, principale en tête (page produit). */
  images: string[];
  /** Guide des tailles (texte libre), ou null s'il n'est pas renseigné. */
  sizeGuide: string | null;
  available: boolean; // true → en vente (sinon « bientôt disponible »)
  /**
   * Personnalisation nom / numéro proposée (interrupteur du back-office, éteint par
   * défaut ; toujours faux tant que la migration de personnalisation n'est pas passée).
   */
  personalizable: boolean;
  /** Supplément par pièce personnalisée, en euros TTC. */
  personalizationPrice: number;
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

const BASE_COLS = "slug, name, name_en, description, description_en, price, category, icon, image, available";
const PAGE_COLS = "images, size_guide, size_guide_en"; // migration_pages_produit_02102026.sql
const PERSO_COLS = "personalizable, personalization_price"; // migration_personnalisation_05102026.sql
const VARIANT_COLS = "variants:product_variants(id, size, stock, position)"; // migration boutique

/**
 * Colonnes demandées, de la plus complète à la plus ancienne : le code peut
 * être déployé AVANT une migration. Il perd alors la fonction concernée
 * (photos supplémentaires, ou les tailles — rien n'est en vente), pas tout
 * le catalogue.
 */
const COLUMN_SETS = [
  `${BASE_COLS}, ${PERSO_COLS}, ${PAGE_COLS}, ${VARIANT_COLS}`,
  `${BASE_COLS}, ${PAGE_COLS}, ${VARIANT_COLS}`,
  `${BASE_COLS}, ${PERSO_COLS}, ${VARIANT_COLS}`,
  `${BASE_COLS}, ${VARIANT_COLS}`,
  BASE_COLS,
];
/** Postgres « colonne inconnue », PostgREST « relation / colonne absente du schéma ». */
const SCHEMA_ERRORS = new Set(["42703", "PGRST200", "PGRST204"]);

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
  images?: string[] | null;
  size_guide?: string | null;
  size_guide_en?: string | null;
  available: boolean | null;
  personalizable?: boolean | null;
  personalization_price?: number | string | null;
  variants?: { id: string; size: string | null; stock: number | null; position: number | null }[] | null;
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
    images: [...new Set([row.image, ...(row.images ?? [])].filter((u): u is string => Boolean(u)))],
    sizeGuide: localizedText(row.size_guide, row.size_guide_en, locale)?.trim() || null,
    available: Boolean(row.available),
    personalizable: row.personalizable === true,
    personalizationPrice: Math.max(0, Number(row.personalization_price ?? 0)) || 0,
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

    for (const cols of COLUMN_SETS) {
      const { data, error } = await query(cols);
      if (!error) return (data ?? []) as unknown as ProductRow[];
      console.error("[boutique] select:", error.code, error.message);
      // On ne retombe sur des colonnes plus anciennes que si c'est le schéma
      // qui manque (colonne inconnue, table des tailles absente) ; une panne
      // réseau ne se règle pas en demandant moins.
      if (!SCHEMA_ERRORS.has(error.code ?? "")) return [];
    }
    return [];
  },
  ["products-list"],
  { tags: [CACHE_TAGS.products], revalidate: CACHE_TTL_SECONDS },
);

/** Liste des produits actifs, ordonnés pour l'affichage, dans `locale`. */
export async function getProducts(locale: string): Promise<Product[]> {
  return (await fetchProducts()).map((row) => toProduct(row, locale));
}

/** Un produit actif par son slug (même cache que la liste), ou null. */
export async function getProductBySlug(slug: string, locale: string): Promise<Product | null> {
  const row = (await fetchProducts()).find((r) => r.slug === slug);
  return row ? toProduct(row, locale) : null;
}

/** Slugs des produits actifs (pages produit prégénérées, sitemap). */
export async function getProductSlugs(): Promise<string[]> {
  return (await fetchProducts()).map((r) => r.slug);
}
