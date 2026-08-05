"use server";

import { revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { processAndUploadImage } from "@/lib/storage-image";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";

// Rôles d'un joueur de roster (garde-fou : un rôle inconnu retombe sur "Joueur").
// Un membre de pôle n'a PAS de rôle propre : le pôle lui-même est le rôle.
const ROSTER_ROLES = ["Joueur", "Capitaine", "Coach", "Manager", "Sub"] as const;
const POLE_MEMBER_ROLE = "Membre"; // valeur interne, jamais affichée côté public
const POLE_CATEGORIES = ["staff", "esport"] as const;
const POLE_VARIANTS = ["founder", "staff", "member", "creative"] as const;

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

// --- Photos : upload vers Supabase Storage (bucket public "joueurs") ---
const PHOTO_BUCKET = "joueurs";
const MAX_DIMENSION = 800; // px : les cartes affichent ~300px → marge « retina »

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

// Traitement + vérification mutualisés avec les visuels produits
// (@/lib/storage-image) : une seule implémentation, un seul garde-fou.
const uploadPhoto = (admin: AdminClient, file: File, slug: string) =>
  processAndUploadImage(admin, file, {
    bucket: PHOTO_BUCKET,
    slug,
    fallbackName: "membre",
    maxDimension: MAX_DIMENSION,
    label: "photo",
  });

/** Normalise un texte en slug URL-safe (ex: "Roster SSL" → "roster-ssl"). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Renvoie un slug libre pour la table `joueurs` (slug unique global).
 * Si `base` est déjà pris par un AUTRE joueur, on suffixe -2, -3, …
 * `excludeId` = l'id du joueur en cours d'édition (son propre slug ne compte pas).
 */
async function uniqueJoueurSlug(
  admin: AdminClient,
  base: string,
  excludeId: string | null,
): Promise<string> {
  const root = base || "membre";
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { data, error } = await admin
      .from("joueurs")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    // Libre, inexistant, ou c'est le joueur lui-même → on garde ce slug.
    if (error || !data || data.id === excludeId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

// ============ ROSTERS ============

export async function createRoster(formData: FormData) {
  const admin = await assertStaff();
  const name = field(formData, "name");
  const slug = slugify(field(formData, "slug") || name);
  if (!name || !slug) throw new Error("Nom et slug obligatoires.");

  const { error } = await admin.from("rosters").insert({
    slug,
    name,
    rank: field(formData, "rank") || null,
    description: field(formData, "description") || null,
    description_en: field(formData, "description_en") || null,
    capacity: intField(formData, "capacity", 3),
    recrute: field(formData, "recrute") || null,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  });
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/rosters");
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
}

export async function updateRoster(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const name = field(formData, "name");
  const slug = slugify(field(formData, "slug") || name);

  const { error } = await admin
    .from("rosters")
    .update({
      slug,
      name,
      rank: field(formData, "rank") || null,
      description: field(formData, "description") || null,
      description_en: field(formData, "description_en") || null,
      capacity: intField(formData, "capacity", 3),
      recrute: field(formData, "recrute") || null,
      position: intField(formData, "position", 0),
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/rosters");
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
  revalidateLocalizedPath(`/equipes/${slug}`);
}

export async function deleteRoster(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("rosters").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/rosters");
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
}

// ============ PÔLES ============

export async function createPole(formData: FormData) {
  const admin = await assertStaff();
  const name = field(formData, "name");
  const slug = slugify(field(formData, "slug") || name);
  if (!name || !slug) throw new Error("Nom et slug obligatoires.");

  const categoryRaw = field(formData, "category");
  const category = (POLE_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? categoryRaw
    : "staff";
  const variantRaw = field(formData, "variant");
  const variant = (POLE_VARIANTS as readonly string[]).includes(variantRaw)
    ? variantRaw
    : "staff";

  const { error } = await admin.from("poles").insert({
    slug,
    name,
    name_en: field(formData, "name_en") || null,
    description: field(formData, "description") || null,
    description_en: field(formData, "description_en") || null,
    category,
    capacity: intField(formData, "capacity", 1),
    recrute: field(formData, "recrute") || null,
    fixed: formData.get("fixed") === "on",
    variant,
    badge: field(formData, "badge") || null,
    badge_en: field(formData, "badge_en") || null,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  });
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/poles");
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
}

export async function updatePole(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const name = field(formData, "name");
  const slug = slugify(field(formData, "slug") || name);

  const categoryRaw = field(formData, "category");
  const category = (POLE_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? categoryRaw
    : "staff";
  const variantRaw = field(formData, "variant");
  const variant = (POLE_VARIANTS as readonly string[]).includes(variantRaw)
    ? variantRaw
    : "staff";

  const { error } = await admin
    .from("poles")
    .update({
      slug,
      name,
      name_en: field(formData, "name_en") || null,
      description: field(formData, "description") || null,
      description_en: field(formData, "description_en") || null,
      category,
      capacity: intField(formData, "capacity", 1),
      recrute: field(formData, "recrute") || null,
      fixed: formData.get("fixed") === "on",
      variant,
      badge: field(formData, "badge") || null,
      badge_en: field(formData, "badge_en") || null,
      position: intField(formData, "position", 0),
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/poles");
  revalidateLocalizedPath(`/admin/poles/${slug}`);
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
}

export async function deletePole(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("poles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/poles");
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
}

// ============ JOUEURS / MEMBRES ============

export async function upsertPlayer(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id"); // vide = création
  const rosterId = field(formData, "roster_id");
  const poleId = field(formData, "pole_id");
  // Un membre appartient à un roster OU un pôle, jamais aux deux.
  if (!rosterId && !poleId) throw new Error("Roster ou pôle manquant.");
  if (rosterId && poleId) throw new Error("Un membre ne peut pas avoir un roster ET un pôle.");
  const pseudo = field(formData, "pseudo");
  if (!pseudo) throw new Error("Le pseudo est obligatoire.");

  // Slug unique global : on suffixe automatiquement en cas de collision de pseudo.
  const slug = await uniqueJoueurSlug(admin, slugify(field(formData, "slug") || pseudo), id || null);
  // Un membre de pôle n'a pas de rôle propre (le pôle = le rôle) → valeur interne.
  // Un joueur de roster a un rôle validé contre la liste connue.
  const roleRaw = field(formData, "role");
  const role = poleId
    ? POLE_MEMBER_ROLE
    : (ROSTER_ROLES as readonly string[]).includes(roleRaw)
      ? roleRaw
      : "Joueur";
  const paysCode = field(formData, "pays_code");
  const mmrRaw = field(formData, "mmr");
  const lines = (name: string) =>
    field(formData, name)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const palmares = lines("palmares");
  const palmaresEn = lines("palmares_en");

  // Photo : un fichier uploadé est prioritaire ; sinon on garde l'URL saisie.
  let photoUrl = field(formData, "photo_url") || null;
  const photoFile = formData.get("photo_file");
  if (photoFile instanceof File && photoFile.size > 0) {
    photoUrl = await uploadPhoto(admin, photoFile, slug);
  }

  const row = {
    roster_id: rosterId || null,
    pole_id: poleId || null,
    slug,
    pseudo,
    nom: field(formData, "nom") || null,
    photo_url: photoUrl,
    pays: field(formData, "pays") || null,
    pays_code: paysCode ? paysCode.toUpperCase() : null,
    role,
    bio: field(formData, "bio") || null,
    // Traduction facultative : `null` = « absent » pour le site, qui retombe
    // alors sur le français.
    bio_en: field(formData, "bio_en") || null,
    rang: field(formData, "rang") || null,
    mmr: mmrRaw && Number.isFinite(Number(mmrRaw)) ? Number(mmrRaw) : null,
    twitter: field(formData, "twitter") || null,
    twitch: field(formData, "twitch") || null,
    rltracker: field(formData, "rltracker") || null,
    palmares,
    palmares_en: palmaresEn,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  };

  const { error } = id
    ? await admin.from("joueurs").update(row).eq("id", id)
    : await admin.from("joueurs").insert(row);
  if (error) {
    // Filet de sécurité si une contrainte d'unicité saute malgré tout.
    if (error.code === "23505") {
      throw new Error("Un membre avec ce pseudo/slug existe déjà — change le slug.");
    }
    throw new Error(error.message);
  }

  // Revalidation ciblée selon le parent.
  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
  // La fiche du membre lui-même : elle est prégénérée depuis le passage en ISR,
  // et personne ne l'invalidait. Un changement de pseudo, de bio ou de photo
  // serait resté invisible sur sa page pendant une heure.
  revalidateLocalizedPath("/equipes/[roster]/[joueur]");
  if (rosterId) {
    const { data: roster } = await admin
      .from("rosters")
      .select("slug")
      .eq("id", rosterId)
      .maybeSingle();
    revalidateLocalizedPath("/admin/rosters");
    if (roster?.slug) {
      revalidateLocalizedPath(`/admin/rosters/${roster.slug}`);
      revalidateLocalizedPath(`/equipes/${roster.slug}`);
    }
  } else {
    const { data: pole } = await admin
      .from("poles")
      .select("slug")
      .eq("id", poleId)
      .maybeSingle();
    revalidateLocalizedPath("/admin/poles");
    if (pole?.slug) {
      revalidateLocalizedPath(`/admin/poles/${pole.slug}`);
      // Un pôle a aussi sa page publique de détail — elle manquait ici.
      revalidateLocalizedPath(`/equipes/${pole.slug}`);
    }
  }
}

export async function deletePlayer(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const rosterSlug = field(formData, "roster_slug");
  const poleSlug = field(formData, "pole_slug");

  const { error } = await admin.from("joueurs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateTag(CACHE_TAGS.equipes, "max"); // invalide le cache data (fetchGroups, rosters, pôles…)
  revalidateLocalizedPath("/equipes");
  if (rosterSlug) {
    revalidateLocalizedPath("/admin/rosters");
    revalidateLocalizedPath(`/admin/rosters/${rosterSlug}`);
    revalidateLocalizedPath(`/equipes/${rosterSlug}`);
  }
  if (poleSlug) {
    revalidateLocalizedPath("/admin/poles");
    revalidateLocalizedPath(`/admin/poles/${poleSlug}`);
  }
}
