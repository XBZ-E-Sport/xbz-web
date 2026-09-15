// Couche d'accès aux partenaires & sponsors.
// Source : table Supabase `partners` (lecture publique des entrées actives,
// via RLS `active = true`). Les pages consomment ces fonctions sans savoir
// d'où viennent les données.
//
// Deux groupes via `type` : 'sponsor' (mis en avant) et 'partenaire'.

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import { localizedText } from "@/lib/localized";

export const partnerTypes = ["sponsor", "partenaire"] as const;
export type PartnerType = (typeof partnerTypes)[number];

export type Partner = {
  id: string;
  name: string;
  type: PartnerType;
  description: string;
  logo: string | null;
  url: string | null;
};

const PARTNER_COLS = "id, name, type, description, description_en, logo, url";

/** Normalise un type inconnu vers "partenaire" (garde-fou d'affichage). */
function normalizeType(value: string): PartnerType {
  return (partnerTypes as readonly string[]).includes(value)
    ? (value as PartnerType)
    : "partenaire";
}

type PartnerRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  description_en: string | null;
  logo: string | null;
  url: string | null;
};

/** Ligne brute → partenaire dans UNE langue (résolution hors cache, cf. boutique.ts). */
function toPartner(row: PartnerRow, locale: string): Partner {
  return {
    id: row.id,
    name: row.name,
    type: normalizeType(row.type),
    description: localizedText(row.description, row.description_en, locale) ?? "",
    logo: row.logo ?? null,
    url: row.url ?? null,
  };
}

/** Lecture brute, bilingue, mise en cache (une entrée sert les deux langues). */
const fetchPartners = unstable_cache(
  async (): Promise<PartnerRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("partners")
      .select(PARTNER_COLS)
      .eq("active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[partenaires] select:", error.message);
      return [];
    }
    return (data ?? []) as PartnerRow[];
  },
  ["partners-list"],
  { tags: [CACHE_TAGS.partenaires], revalidate: CACHE_TTL_SECONDS },
);

/** Partenaires actifs, ordonnés, dans `locale` (tous types confondus). */
export async function getPartners(locale: string): Promise<Partner[]> {
  return (await fetchPartners()).map((row) => toPartner(row, locale));
}
