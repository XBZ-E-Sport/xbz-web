"use server";

import { revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { processAndUploadImage } from "@/lib/storage-image";
import { mediaTypes, mediaCategories } from "@/lib/medias";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function intField(fd: FormData, key: string, def: number): number {
  const raw = field(fd, key);
  if (raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

function normalizeType(value: string): string {
  return (mediaTypes as readonly string[]).includes(value) ? value : "photo";
}

function normalizeCategory(value: string): string {
  return (mediaCategories as readonly string[]).includes(value) ? value : "events";
}

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

// --- Images (photos + vignettes) : upload vers Supabase Storage (bucket "medias") ---
const IMAGE_BUCKET = "medias";
const MAX_DIMENSION = 1600; // px — une photo de galerie mérite du détail

const uploadImage = (admin: AdminClient, file: File, title: string) =>
  processAndUploadImage(admin, file, {
    bucket: IMAGE_BUCKET,
    slug:
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "media",
    fallbackName: "media",
    maxDimension: MAX_DIMENSION,
    label: "image",
  });

async function buildRow(admin: AdminClient, formData: FormData) {
  const type = normalizeType(field(formData, "type"));
  const title = field(formData, "title");

  // Image : un fichier uploadé est prioritaire ; sinon l'URL saisie.
  let image = field(formData, "image_url") || null;
  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    image = await uploadImage(admin, imageFile, title);
  }

  const videoUrl = field(formData, "video_url") || null;

  // Garde-fous : une vidéo a besoin d'un lien ; une photo a besoin d'une image.
  if (type === "video" && !videoUrl) {
    throw new Error("Une vidéo a besoin d'un lien (YouTube / Twitch).");
  }
  if (type === "photo" && !image) {
    throw new Error("Une photo a besoin d'une image (upload ou URL).");
  }

  return {
    type,
    title,
    category: normalizeCategory(field(formData, "category")),
    image,
    video_url: videoUrl,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  };
}

function revalidateGalerie() {
  revalidateTag(CACHE_TAGS.medias, "max");
  revalidateLocalizedPath("/admin/galerie");
  revalidateLocalizedPath("/galerie");
}

export async function createMedia(formData: FormData) {
  const admin = await assertStaff();
  const { error } = await admin.from("medias").insert(await buildRow(admin, formData));
  if (error) throw new Error(error.message);

  revalidateGalerie();
}

export async function updateMedia(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("medias").update(await buildRow(admin, formData)).eq("id", id);
  if (error) throw new Error(error.message);

  revalidateGalerie();
}

export async function deleteMedia(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("medias").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateGalerie();
}
