// Couche d'accès aux offres d'emploi (« Carrières »).
// Source : table Supabase `job_offers` (lecture publique des offres actives,
// via RLS `active = true`). Contient aussi le constructeur des données
// structurées `JobPosting` (schema.org) — c'est LUI qu'Indeed et Google for
// Jobs lisent pour récupérer une offre.

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import { localizedText, localizedList, countryName } from "@/lib/localized";
import { siteConfig, absoluteUrl, localizedPath } from "@/lib/site";

// Types de contrat au format schema.org (JobPosting.employmentType). L'ordre est
// celui du sélecteur du back-office ; le libellé affiché est traduit côté page.
export const employmentTypes = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACTOR",
  "TEMPORARY",
  "INTERN",
  "VOLUNTEER",
] as const;
export type EmploymentType = (typeof employmentTypes)[number];

// Périodes de salaire (schema.org UnitText).
export const salaryPeriods = ["HOUR", "MONTH", "YEAR"] as const;
export type SalaryPeriod = (typeof salaryPeriods)[number];

export type Offer = {
  slug: string;
  title: string;
  excerpt: string;
  description: string[]; // paragraphes
  department: string;
  employmentType: EmploymentType;
  remote: boolean;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string; // code ISO alpha-2
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod;
  datePosted: string; // ISO YYYY-MM-DD
  validThrough: string | null;
  applyUrl: string | null;
};

const OFFER_COLS =
  "slug, title, title_en, excerpt, excerpt_en, description, description_en, " +
  "department, department_en, employment_type, remote, city, region, postal_code, country, " +
  "salary_min, salary_max, salary_period, date_posted, valid_through, apply_url";

function normalizeEmployment(value: string): EmploymentType {
  return (employmentTypes as readonly string[]).includes(value)
    ? (value as EmploymentType)
    : "FULL_TIME";
}

function normalizePeriod(value: string): SalaryPeriod {
  return (salaryPeriods as readonly string[]).includes(value)
    ? (value as SalaryPeriod)
    : "MONTH";
}

type OfferRow = {
  slug: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
  excerpt_en: string | null;
  description: string[] | null;
  description_en: string[] | null;
  department: string | null;
  department_en: string | null;
  employment_type: string;
  remote: boolean | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  salary_min: number | string | null;
  salary_max: number | string | null;
  salary_period: string;
  date_posted: string;
  valid_through: string | null;
  apply_url: string | null;
};

const num = (v: number | string | null): number | null =>
  v === null || v === "" ? null : Number(v);

/**
 * Ligne brute → offre dans UNE langue. Résolution hors cache : une seule entrée
 * de cache sert les deux langues (même principe que les articles).
 */
function toOffer(row: OfferRow, locale: string): Offer {
  return {
    slug: row.slug,
    title: localizedText(row.title, row.title_en, locale) ?? row.title,
    excerpt: localizedText(row.excerpt, row.excerpt_en, locale) ?? "",
    description: localizedList(row.description, row.description_en, locale),
    department: localizedText(row.department, row.department_en, locale) ?? "",
    employmentType: normalizeEmployment(row.employment_type),
    remote: Boolean(row.remote),
    city: row.city ?? null,
    region: row.region ?? null,
    postalCode: row.postal_code ?? null,
    country: row.country ?? "FR",
    salaryMin: num(row.salary_min),
    salaryMax: num(row.salary_max),
    salaryPeriod: normalizePeriod(row.salary_period),
    datePosted: row.date_posted,
    validThrough: row.valid_through ?? null,
    applyUrl: row.apply_url ?? null,
  };
}

const fetchOffers = unstable_cache(
  async (): Promise<OfferRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("job_offers")
      .select(OFFER_COLS)
      .eq("active", true)
      .order("position", { ascending: true })
      .order("date_posted", { ascending: false });

    if (error) {
      console.error("[offres] select:", error.message);
      return [];
    }
    return (data ?? []) as unknown as OfferRow[];
  },
  ["offers-list"],
  { tags: [CACHE_TAGS.offres], revalidate: CACHE_TTL_SECONDS },
);

/**
 * Lieu lisible d'une offre, pays TOUJOURS compris (Indeed : « un lieu par
 * offre ») : « Télétravail (France) », « Lyon, Auvergne-Rhône-Alpes, France ».
 * `remoteLabel` est le libellé traduit du télétravail.
 */
export function formatOfferLocation(offer: Offer, locale: string, remoteLabel: string): string {
  const country = countryName(offer.country, offer.country, locale) ?? offer.country;
  return offer.remote
    ? `${remoteLabel} (${[offer.region, country].filter(Boolean).join(", ")})`
    : [offer.city, offer.region, country].filter(Boolean).join(", ");
}

/** Date du jour à Paris (AAAA-MM-JJ) : la référence des dates d'une offre. */
export function todayInParis(now = new Date()): string {
  // en-CA formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** Vrai si l'offre est encore valable ce jour-là (`validThrough` inclus). */
export function isOfferOpen(validThrough: string | null, today: string): boolean {
  return !validThrough || validThrough >= today;
}

/**
 * Offres ouvertes vues comme des RÔLES du formulaire de recrutement (staff) :
 * postuler à une offre, c'est candidater à ce rôle — même formulaire, même
 * consentement RGPD, même notification du staff, même purge. `name` est
 * l'intitulé FRANÇAIS : c'est la valeur que le serveur revalide (`isRoleOpen`),
 * comme pour les rôles des pôles.
 */
export async function getOfferRoles(): Promise<{ slug: string; name: string }[]> {
  return (await fetchOpenOffers()).map((row) => ({ slug: row.slug, name: row.title }));
}

// Une offre dont la date de fin est passée est FERMÉE partout à la fois :
// liste, fiche (404), sitemap et rôles du formulaire. Sinon « Postuler »
// menait à un formulaire où le poste n'existait plus, et Indeed continuait de
// voir une offre expirée en ligne. Les pages sont régénérées au plus tard
// toutes les heures (ISR) : l'offre disparaît dans l'heure qui suit minuit.
async function fetchOpenOffers(): Promise<OfferRow[]> {
  const today = todayInParis();
  return (await fetchOffers()).filter((row) => isOfferOpen(row.valid_through, today));
}

/** Slugs des offres ouvertes — prégénération des pages de détail au build. */
export async function getOfferSlugs(): Promise<string[]> {
  return (await fetchOpenOffers()).map((row) => row.slug);
}

/** Offres ouvertes, ordonnées, dans `locale`. */
export async function getOffers(locale: string): Promise<Offer[]> {
  return (await fetchOpenOffers()).map((row) => toOffer(row, locale));
}

const fetchOfferBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<OfferRow | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("job_offers")
        .select(OFFER_COLS)
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        console.error("[offre] select:", error.message);
        return null;
      }
      return (data as unknown as OfferRow) ?? null;
    },
    ["offer-by-slug"],
    { tags: [CACHE_TAGS.offres], revalidate: CACHE_TTL_SECONDS },
  ),
);

/** Une offre OUVERTE par son slug dans `locale`, ou null (→ 404). */
export async function getOfferBySlug(slug: string, locale: string): Promise<Offer | null> {
  const row = await fetchOfferBySlug(slug);
  return row && isOfferOpen(row.valid_through, todayInParis()) ? toOffer(row, locale) : null;
}

// =============================================================================
//  Données structurées JobPosting (schema.org)
//
//  C'est le cœur de l'intégration Indeed : ce bloc, injecté en JSON-LD dans la
//  page de détail, décrit l'offre dans un format que les moteurs d'emploi lisent
//  directement. Fonction PURE (pas d'accès base) → testable, et c'est le contrat
//  qu'on vérifie par un test dédié.
// =============================================================================

/** Échappe le texte utilisateur avant de le mettre dans le HTML de description. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function jobPostingJsonLd(offer: Offer, locale: string): Record<string, unknown> {
  // L'adresse RÉELLE de la page, langue comprise : `/carrieres/…` sans langue
  // redirige, et Indeed exige une URL unique et valide par offre.
  const url = absoluteUrl(localizedPath(`/carrieres/${offer.slug}`, locale));

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    // Description en HTML, chaque paragraphe échappé (le texte vient du
    // back-office). Indeed/Google attendent du HTML dans ce champ.
    description: offer.description.map((p) => `<p>${escapeHtml(p)}</p>`).join(""),
    datePosted: offer.datePosted,
    employmentType: offer.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: siteConfig.name,
      sameAs: siteConfig.url,
      logo: absoluteUrl("/logo-xbz-light.png"),
    },
    identifier: {
      "@type": "PropertyValue",
      name: siteConfig.name,
      value: offer.slug,
    },
    url,
  };

  if (offer.validThrough) jsonLd.validThrough = offer.validThrough;
  if (offer.department) jsonLd.occupationalCategory = offer.department;

  // Localisation : TOUJOURS un lieu (Indeed : « un lieu par offre »), même en
  // télétravail — l'adresse complète dès qu'une ville est connue, sinon au
  // moins la région et le pays.
  jsonLd.jobLocation = {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      ...(offer.city ? { addressLocality: offer.city } : {}),
      ...(offer.region ? { addressRegion: offer.region } : {}),
      ...(offer.city && offer.postalCode ? { postalCode: offer.postalCode } : {}),
      addressCountry: offer.country,
    },
  };
  // …et le marqueur télétravail quand l'offre est à distance. Google exige
  // alors `applicantLocationRequirements` (pays d'où l'on peut postuler).
  if (offer.remote) {
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = {
      "@type": "Country",
      name: offer.country,
    };
  }

  // Salaire (facultatif) : ajouté seulement si une borne est renseignée.
  if (offer.salaryMin !== null || offer.salaryMax !== null) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "EUR",
      value: {
        "@type": "QuantitativeValue",
        ...(offer.salaryMin !== null ? { minValue: offer.salaryMin } : {}),
        ...(offer.salaryMax !== null ? { maxValue: offer.salaryMax } : {}),
        unitText: offer.salaryPeriod,
      },
    };
  }

  return jsonLd;
}
