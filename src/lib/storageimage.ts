import "server-only";

import sharp from "sharp";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 Mo à l'entrée

type Options = {
  /** Bucket public de destination ("products", "joueurs"…). */
  bucket: string;
  /** Base du nom de fichier ; un horodatage est ajouté pour éviter les collisions. */
  slug: string;
  /** Nom de repli si le slug est vide. */
  fallbackName: string;
  /** Côté le plus long après redimensionnement. */
  maxDimension: number;
  /** Mot employé dans les messages d'erreur (« image », « photo »). */
  label: string;
};

/**
 * Redimensionne, compresse en WebP, envoie dans un bucket public, RELIT le
 * résultat pour vérifier qu'il est décodable, et renvoie son URL publique.
 *
 * La relecture n'est pas de la paranoïa gratuite. Un visuel produit s'est
 * retrouvé stocké avec 69 % de son contenu remplacé par le caractère U+FFFD
 * (« � ») : des octets binaires passés quelque part par un décodage UTF-8. Le
 * fichier avait le bon nom, le bon type MIME, une taille crédible — et n'était
 * plus une image. Personne ne l'a vu avant qu'un cadre vide n'apparaisse en
 * boutique, plusieurs heures après.
 *
 * Un aller-retour réseau de plus sur une action d'administration est un prix
 * dérisoire pour transformer une corruption silencieuse et définitive en un
 * message d'erreur immédiat.
 */
export async function processAndUploadImage(
  admin: AdminClient,
  file: File,
  { bucket, slug, fallbackName, maxDimension, label }: Options,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error(`Le fichier doit être une ${label}.`);
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${cap(label)} trop lourde (5 Mo max).`);

  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate() // respecte l'orientation EXIF (photos de téléphone)
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const path = `${slug || fallbackName}-${Date.now()}.webp`;
  const { error } = await admin.storage.from(bucket).upload(path, output, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) throw new Error(`Upload ${label} : ${error.message}`);

  await assertStoredImageIsReadable(admin, bucket, path, label);

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Relit l'objet fraîchement stocké et refuse de valider s'il n'est pas une
 * image décodable. En cas d'échec on SUPPRIME l'objet : mieux vaut aucun visuel
 * qu'une URL enregistrée en base qui pointe vers un fichier illisible.
 */
async function assertStoredImageIsReadable(
  admin: AdminClient,
  bucket: string,
  path: string,
  label: string,
): Promise<void> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    await admin.storage.from(bucket).remove([path]);
    throw new Error(`Relecture ${label} impossible : ${error?.message ?? "fichier introuvable"}.`);
  }

  const stored = Buffer.from(await data.arrayBuffer());
  try {
    const meta = await sharp(stored).metadata();
    if (!meta.width || !meta.height) throw new Error("dimensions absentes");
  } catch {
    await admin.storage.from(bucket).remove([path]);
    throw new Error(
      `${cap(label)} corrompue au stockage (le fichier relu n'est pas une image valide). ` +
        `Rien n'a été enregistré — réessaie, et signale-le si ça recommence.`,
    );
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
