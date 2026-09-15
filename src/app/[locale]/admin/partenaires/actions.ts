"use server";

import { revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { processAndUploadImage } from "@/lib/storage-image";
import { partnerTypes } from "@/lib/partenaires";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";

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

function normalizeType(value: string): string {
  return (partnerTypes as readonly string[]).includes(value) ? value : "partenaire";
}

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

// --- Logos : upload vers Supabase Storage (bucket public "partners") ---
// Même traitement + vérification que les visuels produits (@/lib/storage-image).
const LOGO_BUCKET = "partners";
const MAX_DIMENSION = 600; // px — un logo n'a pas besoin de plus

const uploadLogo = (admin: AdminClient, file: File, name: string) =>
  processAndUploadImage(admin, file, {
    bucket: LOGO_BUCKET,
    slug: name,
    fallbackName: "partenaire",
    maxDimension: MAX_DIMENSION,
    label: "logo",
  });

/** Nom de fichier de logo dérivé du nom du partenaire (accents/espaces retirés). */
function logoBaseName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "partenaire"
  );
}

/** Champs communs create/update, dérivés du formulaire. */
async function buildRow(admin: AdminClient, formData: FormData) {
  const name = field(formData, "name");

  // Logo : un fichier uploadé est prioritaire ; sinon on garde l'URL saisie.
  let logo = field(formData, "logo_url") || null;
  const logoFile = formData.get("logo_file");
  if (logoFile instanceof File && logoFile.size > 0) {
    logo = await uploadLogo(admin, logoFile, logoBaseName(name));
  }

  return {
    name,
    type: normalizeType(field(formData, "type")),
    description: field(formData, "description") || "",
    // Traduction facultative : `null` plutôt que "" — c'est ce que le site lit
    // comme « absent », et ça reste vrai quand on vide le champ.
    description_en: field(formData, "description_en") || null,
    logo,
    url: field(formData, "url") || null,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  };
}

function revalidatePartenaires() {
  // Invalide le cache de données de la lecture publique (getPartners).
  revalidateTag(CACHE_TAGS.partenaires, "max");
  revalidateLocalizedPath("/admin/partenaires");
  revalidateLocalizedPath("/partenaires");
  revalidateLocalizedPath("/"); // le bandeau de logos de la page d'accueil
}

export async function createPartner(formData: FormData) {
  const admin = await assertStaff();
  const name = field(formData, "name");
  if (!name) throw new Error("Le nom est obligatoire.");

  const row = await buildRow(admin, formData);
  const { error } = await admin.from("partners").insert(row);
  if (error) throw new Error(error.message);

  revalidatePartenaires();
}

export async function updatePartner(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const name = field(formData, "name");
  if (!name) throw new Error("Le nom est obligatoire.");

  const row = await buildRow(admin, formData);
  const { error } = await admin.from("partners").update(row).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePartenaires();
}

export async function deletePartner(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("partners").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePartenaires();
}
