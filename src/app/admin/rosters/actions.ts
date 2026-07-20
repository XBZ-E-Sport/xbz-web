"use server";

import { revalidatePath } from "next/cache";

import { assertStaff } from "@/lib/adminguard";

// Rôles connus (rosters esport + membres de pôles staff). La liste sert de
// garde-fou : un rôle inconnu retombe sur la valeur par défaut.
const ROLES = [
  "Joueur",
  "Capitaine",
  "Coach",
  "Manager",
  "Sub",
  "Membre",
  "Responsable",
] as const;
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
  const roleRaw = field(formData, "role");
  const role = (ROLES as readonly string[]).includes(roleRaw)
    ? roleRaw
    : poleId
      ? "Membre"
      : "Joueur";
  const paysCode = field(formData, "pays_code");
  const mmrRaw = field(formData, "mmr");
  const palmares = field(formData, "palmares")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const row = {
    roster_id: rosterId || null,
    pole_id: poleId || null,
    slug,
    pseudo,
    nom: field(formData, "nom") || null,
    photo_url: field(formData, "photo_url") || null,
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
