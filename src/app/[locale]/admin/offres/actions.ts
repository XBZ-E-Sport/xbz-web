"use server";

import { revalidateTag } from "next/cache";

import { assertStaff } from "@/lib/adminguard";
import { employmentTypes, salaryPeriods } from "@/lib/offres";
import { CACHE_TAGS, revalidateLocalizedPath } from "@/lib/cache";

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Nombre positif ou null (bornes de salaire facultatives). */
function numberOrNull(fd: FormData, key: string): number | null {
  const raw = field(fd, key);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Un paragraphe par bloc séparé d'une ligne vide. */
function paragraphs(fd: FormData, key: string): string[] {
  return field(fd, key)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type AdminClient = Awaited<ReturnType<typeof assertStaff>>;

async function uniqueSlug(
  admin: AdminClient,
  base: string,
  excludeId: string | null,
): Promise<string> {
  const root = base || "offre";
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { data, error } = await admin
      .from("job_offers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error || !data || data.id === excludeId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Construit la ligne à écrire, en validant ce qu'Indeed exige. */
function buildRow(fd: FormData) {
  const employmentRaw = field(fd, "employment_type");
  const employment_type = (employmentTypes as readonly string[]).includes(employmentRaw)
    ? employmentRaw
    : "FULL_TIME";
  const periodRaw = field(fd, "salary_period");
  const salary_period = (salaryPeriods as readonly string[]).includes(periodRaw)
    ? periodRaw
    : "MONTH";

  const remote = fd.get("remote") === "on";
  const city = field(fd, "city") || null;
  // Indeed refuse une offre sans localisation : soit télétravail, soit une ville.
  if (!remote && !city) {
    throw new Error(
      "Une ville est requise pour une offre qui n'est pas en télétravail (exigence Indeed).",
    );
  }

  return {
    title: field(fd, "title"),
    title_en: field(fd, "title_en") || null,
    excerpt: field(fd, "excerpt") || "",
    excerpt_en: field(fd, "excerpt_en") || null,
    description: paragraphs(fd, "description"),
    description_en: paragraphs(fd, "description_en"),
    department: field(fd, "department") || "",
    department_en: field(fd, "department_en") || null,
    employment_type,
    remote,
    city,
    region: field(fd, "region") || null,
    postal_code: field(fd, "postal_code") || null,
    country: field(fd, "country") || "FR",
    salary_min: numberOrNull(fd, "salary_min"),
    salary_max: numberOrNull(fd, "salary_max"),
    salary_period,
    date_posted: field(fd, "date_posted") || null, // null → défaut SQL (current_date)
    valid_through: field(fd, "valid_through") || null,
    apply_url: field(fd, "apply_url") || null,
    active: fd.get("active") === "on",
    position: Number(field(fd, "position")) || 0,
  };
}

function revalidateOffer(slug?: string) {
  revalidateTag(CACHE_TAGS.offres, "max");
  revalidateLocalizedPath("/admin/offres");
  revalidateLocalizedPath("/carrieres");
  if (slug) revalidateLocalizedPath(`/carrieres/${slug}`);
}

export async function createOffer(formData: FormData) {
  const admin = await assertStaff();
  const title = field(formData, "title");
  if (!title) throw new Error("L'intitulé du poste est obligatoire.");

  const slug = await uniqueSlug(admin, slugify(field(formData, "slug") || title), null);
  const { error } = await admin.from("job_offers").insert({ slug, ...buildRow(formData) });
  if (error) {
    if (error.code === "23505") throw new Error("Une offre avec ce slug existe déjà.");
    throw new Error(error.message);
  }

  revalidateOffer(slug);
}

export async function updateOffer(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const title = field(formData, "title");
  if (!title) throw new Error("L'intitulé du poste est obligatoire.");

  const slug = await uniqueSlug(admin, slugify(field(formData, "slug") || title), id);
  const { error } = await admin
    .from("job_offers")
    .update({ slug, ...buildRow(formData) })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Une offre avec ce slug existe déjà.");
    throw new Error(error.message);
  }

  revalidateOffer(slug);
}

export async function deleteOffer(formData: FormData) {
  const admin = await assertStaff();
  const id = field(formData, "id");
  if (!id) throw new Error("Identifiant manquant.");
  const slug = field(formData, "slug");

  const { error } = await admin.from("job_offers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateOffer(slug || undefined);
}
