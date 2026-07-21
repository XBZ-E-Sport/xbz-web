"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { assertStaff } from "@/lib/adminguard";
import { productCategories } from "@/lib/boutique";

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
const IMAGE_BUCKET = "products";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo à l'entrée
const MAX_DIMENSION = 1000; // px

/**
 * Redimensionne + compresse l'image (WebP) avant l'envoi dans le bucket,
 * et renvoie son URL publique.
 */
async function uploadImage(admin: AdminClient, file: File, slug: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Le fichier doit être une image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image trop lourde (5 Mo max).");

  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate() // respecte l'orientation EXIF
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const path = `${slug || "produit"}-${Date.now()}.webp`;
  const { error } = await admin.storage.from(IMAGE_BUCKET).upload(path, output, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) throw new Error(`Upload image : ${error.message}`);

  const { data } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

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
    description: field(formData, "description") || "",
    price: priceField(formData, "price"),
    category: normalizeCategory(field(formData, "category")),
    icon: field(formData, "icon") || "",
    image,
    url: field(formData, "url") || null,
    available: formData.get("available") === "on",
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  };
}

function revalidateBoutique() {
  revalidatePath("/admin/boutique");
  revalidatePath("/boutique");
}

export async function createProduct(formData: FormData) {
  const admin = await assertStaff();
  const name = field(formData, "name");
  if (!name) throw new Error("Le nom est obligatoire.");

  const slug = await uniqueProductSlug(admin, slugify(field(formData, "slug") || name), null);
  const row = await buildRow(admin, formData, slug);
  const { error } = await admin.from("products").insert({ slug, ...row });
  if (error) {
    if (error.code === "23505") throw new Error("Un produit avec ce slug existe déjà.");
    throw new Error(error.message);
  }

  revalidateBoutique();
}

export async function updateProduct(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const name = field(formData, "name");
  if (!name) throw new Error("Le nom est obligatoire.");

  const slug = await uniqueProductSlug(admin, slugify(field(formData, "slug") || name), id);
  const row = await buildRow(admin, formData, slug);
  const { error } = await admin.from("products").update({ slug, ...row }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Un produit avec ce slug existe déjà.");
    throw new Error(error.message);
  }

  revalidateBoutique();
}

export async function deleteProduct(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateBoutique();
}
