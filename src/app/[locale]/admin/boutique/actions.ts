"use server";

import { revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { adminAction, dbError } from "@/lib/admin-action";
import { AdminError, type AdminResult } from "@/lib/admin-result";
import { processAndUploadImage } from "@/lib/storage-image";
import { productCategories } from "@/lib/boutique";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";
import { parseVariants } from "@/lib/variants-form";

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Entier ≥ 0 depuis un champ ; retombe sur `def` si vide ou invalide. */
function intField(fd: FormData, key: string, def: number): number {
  const raw = field(fd, key);
  if (raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

/** Prix en euros : accepte "49,99" ou "49.99", ≥ 0, arrondi au centime. */
function priceField(fd: FormData, key: string): number {
  const raw = field(fd, key).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

/** Normalise un texte en slug URL-safe (ex: "Maillot XBZ !" → "maillot-xbz"). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategory(value: string): string {
  return (productCategories as string[]).includes(value) ? value : "Textile";
}

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

// --- Visuels produits : upload vers Supabase Storage (bucket public "products") ---
// Traitement + vérification mutualisés avec les photos de membres
// (@/lib/storage-image) : une seule implémentation, un seul garde-fou.
const IMAGE_BUCKET = "products";
const MAX_DIMENSION = 1000; // px

const uploadImage = (admin: AdminClient, file: File, slug: string) =>
  processAndUploadImage(admin, file, {
    bucket: IMAGE_BUCKET,
    slug,
    fallbackName: "produit",
    maxDimension: MAX_DIMENSION,
    label: "l’image",
  });

/** Slug libre pour `products` (suffixe -2, -3… si déjà pris). */
async function uniqueProductSlug(
  admin: AdminClient,
  base: string,
  excludeId: string | null,
): Promise<string> {
  const root = base || "produit";
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { data, error } = await admin
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error || !data || data.id === excludeId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Champs communs create/update, dérivés du formulaire. */
async function buildRow(admin: AdminClient, formData: FormData, slug: string) {
  // Image : un fichier uploadé est prioritaire ; sinon on garde l'URL saisie.
  let image = field(formData, "image_url") || null;
  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    image = await uploadImage(admin, imageFile, slug);
  }

  return {
    name: field(formData, "name"),
    // Traductions facultatives : `null` plutôt que "" — c'est ce que le site lit
    // comme « absent », et ça reste vrai quand on vide le champ.
    name_en: field(formData, "name_en") || null,
    description: field(formData, "description") || "",
    description_en: field(formData, "description_en") || null,
    price: priceField(formData, "price"),
    category: normalizeCategory(field(formData, "category")),
    icon: field(formData, "icon") || "",
    image,
    // `url` (ancien lien d'achat externe) n'est plus saisi : la vente passe
    // par le panier et Stripe. La colonne reste en base, intacte.
    available: formData.get("available") === "on",
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  };
}

// --- Tailles & stock -------------------------------------------------------

/**
 * Enregistre les tailles d'un produit. Un stock modifié n'est écrit que s'il
 * vaut encore ce qui était affiché au chargement : si une vente l'a décompté
 * entre-temps, on refuse plutôt que d'effacer cette vente.
 */
async function saveVariants(admin: AdminClient, productId: string, formData: FormData) {
  const { rows, deleted } = parseVariants(formData);
  const keptIds = new Set(rows.map((r) => r.id).filter(Boolean));

  const toDelete = deleted.filter((id) => !keptIds.has(id));
  if (toDelete.length) {
    const { error } = await admin.from("product_variants").delete().eq("product_id", productId).in("id", toDelete);
    if (error) throw dbError(error);
  }

  for (const r of rows.filter((x) => x.id)) {
    const changedStock = r.orig === null || r.stock !== r.orig;
    let query = admin
      .from("product_variants")
      .update(changedStock ? { size: r.size, stock: r.stock, position: r.position } : { size: r.size, position: r.position })
      .eq("id", r.id!)
      .eq("product_id", productId);
    if (changedStock && r.orig !== null) query = query.eq("stock", r.orig);
    const { data, error } = await query.select("id");
    if (error) throw dbError(error, `Taille « ${r.size} » en double.`);
    if (!data?.length) {
      throw new AdminError(
        `Le stock de la taille « ${r.size || "unique"} » a changé pendant ta saisie (une vente ?). Recharge la page puis recommence.`,
      );
    }
  }

  const inserts = rows.filter((x) => !x.id).map((r) => ({ product_id: productId, size: r.size, stock: r.stock, position: r.position }));
  if (inserts.length) {
    const { error } = await admin.from("product_variants").insert(inserts);
    if (error) throw dbError(error, "Une de ces tailles existe déjà pour ce produit.");
  }
}

function revalidateBoutique() {
  // Invalide le cache de données de la lecture publique (getProducts).
  revalidateTag(CACHE_TAGS.products, "max");
  revalidateLocalizedPath("/admin/boutique");
  revalidateLocalizedPath("/boutique");
  revalidateLocalizedPath("/boutique/panier");
}

export async function createProduct(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const name = field(formData, "name");
    if (!name) throw new AdminError("Le nom est obligatoire.");

    // Tailles validées AVANT d'écrire quoi que ce soit.
    parseVariants(formData);
    const slug = await uniqueProductSlug(admin, slugify(field(formData, "slug") || name), null);
    const row = await buildRow(admin, formData, slug);
    const { data, error } = await admin.from("products").insert({ slug, ...row }).select("id").single();
    if (error) throw dbError(error, "Un produit avec ce slug existe déjà.");
    await saveVariants(admin, data.id, formData);

    revalidateBoutique();
  });
}

export async function updateProduct(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = field(formData, "id");
    if (!id) throw new AdminError("Identifiant manquant.");
    const name = field(formData, "name");
    if (!name) throw new AdminError("Le nom est obligatoire.");

    parseVariants(formData);
    const slug = await uniqueProductSlug(admin, slugify(field(formData, "slug") || name), id);
    const row = await buildRow(admin, formData, slug);
    const { error } = await admin.from("products").update({ slug, ...row }).eq("id", id);
    if (error) throw dbError(error, "Un produit avec ce slug existe déjà.");
    await saveVariants(admin, id, formData);

    revalidateBoutique();
  });
}

export async function deleteProduct(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = field(formData, "id");
    if (!id) throw new AdminError("Identifiant manquant.");

    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) throw dbError(error);

    revalidateBoutique();
  });
}
