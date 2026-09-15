"use server";

import { revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { processAndUploadImage } from "@/lib/storage-image";
import { matchFormats, matchStatuses } from "@/lib/matchs";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Entier (score) ≥ 0, ou null si vide/invalide. */
function intOrNull(fd: FormData, key: string): number | null {
  const raw = field(fd, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function normalizeFormat(value: string): string {
  return (matchFormats as readonly string[]).includes(value) ? value : "BO3";
}

function normalizeStatus(value: string): string {
  return (matchStatuses as readonly string[]).includes(value) ? value : "scheduled";
}

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

// --- Logos adversaires : upload vers Supabase Storage (bucket public "matchs") ---
const LOGO_BUCKET = "matchs";
const MAX_DIMENSION = 400; // px — un logo d'adversaire n'a pas besoin de plus

const uploadLogo = (admin: AdminClient, file: File, opponent: string) =>
  processAndUploadImage(admin, file, {
    bucket: LOGO_BUCKET,
    slug: opponent
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "adversaire",
    fallbackName: "adversaire",
    maxDimension: MAX_DIMENSION,
    label: "logo",
  });

/** Champs communs create/update, dérivés du formulaire. */
async function buildRow(admin: AdminClient, formData: FormData) {
  const opponent = field(formData, "opponent");

  // Logo adversaire : un fichier uploadé est prioritaire ; sinon l'URL saisie.
  let opponentLogo = field(formData, "opponent_logo_url") || null;
  const logoFile = formData.get("opponent_logo_file");
  if (logoFile instanceof File && logoFile.size > 0) {
    opponentLogo = await uploadLogo(admin, logoFile, opponent);
  }

  return {
    // Menu déroulant : "" → null (match sans roster rattaché, affiché « XBZ »).
    roster_id: field(formData, "roster_id") || null,
    opponent,
    opponent_logo: opponentLogo,
    competition: field(formData, "competition") || "",
    format: normalizeFormat(field(formData, "format")),
    // Heure murale FR telle que saisie (datetime-local, sans fuseau) : stockée
    // à l'identique dans la colonne `timestamp` sans conversion.
    starts_at: field(formData, "starts_at"),
    status: normalizeStatus(field(formData, "status")),
    score_xbz: intOrNull(formData, "score_xbz"),
    score_opponent: intOrNull(formData, "score_opponent"),
    stream_url: field(formData, "stream_url") || null,
    active: formData.get("active") === "on",
  };
}

function revalidateMatchs() {
  revalidateTag(CACHE_TAGS.matchs, "max");
  revalidateLocalizedPath("/admin/matchs");
  revalidateLocalizedPath("/calendrier");
  revalidateLocalizedPath("/"); // le bandeau « prochain match » de l'accueil
}

export async function createMatch(formData: FormData) {
  const admin = await assertStaff();
  if (!field(formData, "opponent")) throw new Error("L'adversaire est obligatoire.");
  if (!field(formData, "starts_at")) throw new Error("La date du match est obligatoire.");

  const { error } = await admin.from("matchs").insert(await buildRow(admin, formData));
  if (error) throw new Error(error.message);

  revalidateMatchs();
}

export async function updateMatch(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  if (!field(formData, "opponent")) throw new Error("L'adversaire est obligatoire.");
  if (!field(formData, "starts_at")) throw new Error("La date du match est obligatoire.");

  const { error } = await admin.from("matchs").update(await buildRow(admin, formData)).eq("id", id);
  if (error) throw new Error(error.message);

  revalidateMatchs();
}

export async function deleteMatch(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("matchs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateMatchs();
}
