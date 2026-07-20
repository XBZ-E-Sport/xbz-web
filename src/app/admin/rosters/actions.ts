"use server";

import { revalidatePath } from "next/cache";

import { assertStaff } from "@/lib/adminguard";

const ROLES = ["Joueur", "Capitaine", "Coach", "Manager", "Sub"] as const;

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
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
    position: Number(field(formData, "position")) || 0,
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
      position: Number(field(formData, "position")) || 0,
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

// ============ JOUEURS ============

export async function upsertPlayer(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id"); // vide = création
  const rosterId = field(formData, "roster_id");
  if (!rosterId) throw new Error("Roster manquant.");
  const pseudo = field(formData, "pseudo");
  if (!pseudo) throw new Error("Le pseudo est obligatoire.");

  const slug = slugify(field(formData, "slug") || pseudo);
  const roleRaw = field(formData, "role");
  const role = (ROLES as readonly string[]).includes(roleRaw) ? roleRaw : "Joueur";
  const paysCode = field(formData, "pays_code");
  const mmrRaw = field(formData, "mmr");
  const palmares = field(formData, "palmares")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const row = {
    roster_id: rosterId,
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
    position: Number(field(formData, "position")) || 0,
    active: formData.get("active") === "on",
  };

  const { error } = id
    ? await admin.from("joueurs").update(row).eq("id", id)
    : await admin.from("joueurs").insert(row);
  if (error) throw new Error(error.message);

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
}

export async function deletePlayer(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const rosterSlug = field(formData, "roster_slug");

  const { error } = await admin.from("joueurs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rosters");
  if (rosterSlug) {
    revalidatePath(`/admin/rosters/${rosterSlug}`);
    revalidatePath(`/equipes/${rosterSlug}`);
  }
}
