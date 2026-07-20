"use server";

import { revalidatePath } from "next/cache";

import { assertStaff } from "@/lib/adminguard";

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
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 Mo
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

/** Envoie une image dans le bucket et renvoie son URL publique. */
async function uploadPhoto(admin: AdminClient, file: File, slug: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Le fichier doit être une image.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Image trop lourde (5 Mo max).");

  const ext = EXT_BY_TYPE[file.type] ?? (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${slug || "membre"}-${Date.now()}.${ext}`;

  const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(`Upload photo : ${error.message}`);

  const { data } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Normalise un texte en slug URL-safe (ex: "Roster SSL" → "roster-ssl"). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    capacity: intField(formData, "capacity", 3),
    recrute: field(formData, "recrute") || null,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rosters");
  revalidatePath("/equipes");
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
      capacity: intField(formData, "capacity", 3),
      recrute: field(formData, "recrute") || null,
      position: intField(formData, "position", 0),
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rosters");
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${slug}`);
}

export async function deleteRoster(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("rosters").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rosters");
  revalidatePath("/equipes");
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
    description: field(formData, "description") || null,
    category,
    capacity: intField(formData, "capacity", 1),
    recrute: field(formData, "recrute") || null,
    fixed: formData.get("fixed") === "on",
    variant,
    badge: field(formData, "badge") || null,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/poles");
  revalidatePath("/equipes");
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
      description: field(formData, "description") || null,
      category,
      capacity: intField(formData, "capacity", 1),
      recrute: field(formData, "recrute") || null,
      fixed: formData.get("fixed") === "on",
      variant,
      badge: field(formData, "badge") || null,
      position: intField(formData, "position", 0),
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/poles");
  revalidatePath(`/admin/poles/${slug}`);
  revalidatePath("/equipes");
}

export async function deletePole(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");

  const { error } = await admin.from("poles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/poles");
  revalidatePath("/equipes");
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

  const slug = slugify(field(formData, "slug") || pseudo);
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
  const palmares = field(formData, "palmares")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

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
    rang: field(formData, "rang") || null,
    mmr: mmrRaw && Number.isFinite(Number(mmrRaw)) ? Number(mmrRaw) : null,
    twitter: field(formData, "twitter") || null,
    twitch: field(formData, "twitch") || null,
    rltracker: field(formData, "rltracker") || null,
    palmares,
    position: intField(formData, "position", 0),
    active: formData.get("active") === "on",
  };

  const { error } = id
    ? await admin.from("joueurs").update(row).eq("id", id)
    : await admin.from("joueurs").insert(row);
  if (error) throw new Error(error.message);

  // Revalidation ciblée selon le parent.
  revalidatePath("/equipes");
  if (rosterId) {
    const { data: roster } = await admin
      .from("rosters")
      .select("slug")
      .eq("id", rosterId)
      .maybeSingle();
    revalidatePath("/admin/rosters");
    if (roster?.slug) {
      revalidatePath(`/admin/rosters/${roster.slug}`);
      revalidatePath(`/equipes/${roster.slug}`);
    }
  } else {
    const { data: pole } = await admin
      .from("poles")
      .select("slug")
      .eq("id", poleId)
      .maybeSingle();
    revalidatePath("/admin/poles");
    if (pole?.slug) revalidatePath(`/admin/poles/${pole.slug}`);
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

  revalidatePath("/equipes");
  if (rosterSlug) {
    revalidatePath("/admin/rosters");
    revalidatePath(`/admin/rosters/${rosterSlug}`);
    revalidatePath(`/equipes/${rosterSlug}`);
  }
  if (poleSlug) {
    revalidatePath("/admin/poles");
    revalidatePath(`/admin/poles/${poleSlug}`);
  }
}
