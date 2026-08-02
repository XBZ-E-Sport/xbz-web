// Couche data unifiée pour /equipes, les stats et le recrutement.
// Source : tables Supabase `rosters` (esport) + `poles` (staff/esport-staff).
// Le « rempli » de chaque groupe = nombre de membres (joueurs) réellement en
// base ; le « total » = colonne `capacity`. Slots 100 % dynamiques.

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import type { Player } from "@/lib/roster";
import type { RecrutementCategory } from "@/content/recrutement";

export type GroupVariant = "founder" | "staff" | "member" | "creative";

export type Group = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: "staff" | "esport";
  capacity: number;
  filled: number;
  recrute: string | null;
  fixed: boolean;
  variant: GroupVariant;
  /** Texte du badge (pôles). Vide → texte auto dérivé du variant. */
  badge: string | null;
  /** true → roster esport avec une page détail /equipes/[slug]. */
  isRoster: boolean;
};

type CountRel = { count: number }[] | null;
type RosterRow = {
  id: string; slug: string; name: string; description: string | null;
  capacity: number | null; recrute: string | null; joueurs: CountRel;
};
type PoleRow = {
  id: string; slug: string; name: string; description: string | null;
  category: string; capacity: number | null; recrute: string | null;
  fixed: boolean; variant: string; badge: string | null; joueurs: CountRel;
};

function memberCount(rel: CountRel): number {
  return Array.isArray(rel) && rel[0] ? rel[0].count : 0;
}

// Lecture centrale (rosters + pôles). Double cache :
//  - `unstable_cache` : partagé entre requêtes (tag `equipes`), pas de BDD répétée.
//  - `cache` (React) : dédup dans un même rendu si plusieurs helpers dérivés
//    (getEquipes / getStructureStats / getOpenRolesByCategory) l'appellent —
//    cohérent avec getPoleBySlug / getRosterBySlug.
const fetchGroups = cache(
  unstable_cache(
  async (): Promise<{ rosters: Group[]; poles: Group[] }> => {
  const supabase = createPublicClient();

  const [rostersRes, polesRes] = await Promise.all([
    supabase
      .from("rosters")
      .select("id, slug, name, description, position, capacity, recrute, joueurs(count)")
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase
      .from("poles")
      .select("id, slug, name, description, category, capacity, recrute, fixed, variant, badge, position, joueurs(count)")
      .eq("active", true)
      .order("position", { ascending: true }),
  ]);

  if (rostersRes.error) console.error("[equipes] rosters:", rostersRes.error.message);
  if (polesRes.error) console.error("[equipes] poles:", polesRes.error.message);

  const rosters: Group[] = ((rostersRes.data ?? []) as RosterRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: "esport",
    capacity: r.capacity ?? 3,
    filled: memberCount(r.joueurs),
    recrute: r.recrute ?? "Joueur",
    fixed: false,
    variant: "member",
    badge: null,
    isRoster: true,
  }));

  const poles: Group[] = ((polesRes.data ?? []) as PoleRow[]).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category === "esport" ? "esport" : "staff",
    capacity: p.capacity ?? 1,
    filled: memberCount(p.joueurs),
    recrute: p.recrute ?? null,
    fixed: Boolean(p.fixed),
    variant: (["founder", "staff", "member", "creative"].includes(p.variant)
      ? p.variant
      : "staff") as GroupVariant,
    badge: p.badge?.trim() || null,
    isRoster: false,
  }));

    return { rosters, poles };
  },
  ["equipes-groups"],
  { tags: [CACHE_TAGS.equipes], revalidate: CACHE_TTL_SECONDS },
  ),
);

/** Groupes affichés sur /equipes, répartis en sections Staff / Esport. */
export async function getEquipes(): Promise<{ staff: Group[]; esport: Group[] }> {
  const { rosters, poles } = await fetchGroups();
  const staff = poles.filter((p) => p.category === "staff");
  const esport = [...poles.filter((p) => p.category === "esport"), ...rosters];
  return { staff, esport };
}

/** Statistiques de la structure (accueil, présentation). */
export async function getStructureStats() {
  const { rosters, poles } = await fetchGroups();
  const all = [...rosters, ...poles];
  return {
    teams: rosters.length,
    poles: poles.length,
    members: all.reduce((s, g) => s + g.filled, 0),
    openSlots: all.reduce((s, g) => s + Math.max(0, g.capacity - g.filled), 0),
  };
}

const CATEGORY_LABEL: Record<Group["category"], RecrutementCategory> = {
  staff: "XBZ Staff",
  esport: "XBZ Esport",
};

/** Rôles ouverts au recrutement (rempli < capacity), par catégorie. */
export async function getOpenRolesByCategory(): Promise<
  Record<RecrutementCategory, { name: string; free: number }[]>
> {
  const { rosters, poles } = await fetchGroups();
  const acc: Record<RecrutementCategory, Map<string, number>> = {
    "XBZ Staff": new Map(),
    "XBZ Esport": new Map(),
  };

  for (const g of [...rosters, ...poles]) {
    if (!g.recrute || g.fixed) continue;
    const free = g.capacity - g.filled;
    if (free <= 0) continue;
    const cat = CATEGORY_LABEL[g.category];
    acc[cat].set(g.recrute, (acc[cat].get(g.recrute) ?? 0) + free);
  }

  return {
    "XBZ Staff": [...acc["XBZ Staff"]].map(([name, free]) => ({ name, free })),
    "XBZ Esport": [...acc["XBZ Esport"]].map(([name, free]) => ({ name, free })),
  };
}

/** Vrai si le rôle est ouvert dans la catégorie (validation serveur). */
export async function isRoleOpen(categorie: string, role: string): Promise<boolean> {
  if (categorie !== "XBZ Staff" && categorie !== "XBZ Esport") return false;
  const roles = (await getOpenRolesByCategory())[categorie];
  return roles.some((r) => r.name === role);
}

/**
 * Rosters encore OUVERTS au recrutement (rempli < capacity), pour le sélecteur
 * du formulaire de recrutement. Même règle de disponibilité que les rôles :
 * un roster plein (ex. GC3 4/4) n'est plus proposé.
 */
export const getOpenRosters = unstable_cache(
  async (): Promise<{ name: string; rank: string | null }[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("rosters")
      .select("name, rank, capacity, position, joueurs(count)")
      .eq("active", true)
      .order("position", { ascending: true });

    if (error) {
      console.error("[rosters ouverts] select:", error.message);
      return [];
    }

    type OpenRosterRow = { name: string; rank: string | null; capacity: number | null; joueurs: CountRel };
    return ((data ?? []) as OpenRosterRow[])
      .filter((r) => (r.capacity ?? 3) - memberCount(r.joueurs) > 0)
      .map((r) => ({ name: r.name, rank: r.rank }));
  },
  ["open-rosters"],
  { tags: [CACHE_TAGS.equipes], revalidate: CACHE_TTL_SECONDS },
);

// ============ PAGE DÉTAIL D'UN PÔLE ============

export type PoleDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: "staff" | "esport";
  members: Player[];
};

/**
 * Un pôle + ses membres actifs (triés), ou null s'il n'existe pas.
 * Mémoïsé par requête (`cache`) : generateMetadata + la page ne font qu'un appel.
 */
export const getPoleBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<PoleDetail | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("poles")
        .select("id, slug, name, description, category, members:joueurs(*)")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        console.error("[pole] select:", error.message);
        return null;
      }
      if (!data) return null;

      const pole = data as unknown as PoleDetail;
      pole.category = pole.category === "esport" ? "esport" : "staff";
      pole.members = (pole.members ?? []).slice().sort((a, b) => a.position - b.position);
      return pole;
    },
    ["pole-by-slug"],
    { tags: [CACHE_TAGS.equipes], revalidate: CACHE_TTL_SECONDS },
  ),
);

// ============ SITEMAP ============

/**
 * Toutes les URLs /equipes/* dérivées de la base (pour le sitemap) :
 * une par roster/pôle actif + une par joueur/membre actif.
 */
export const getEquipesUrls = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient();
    const [rostersRes, polesRes, joueursRes] = await Promise.all([
      supabase.from("rosters").select("slug").eq("active", true),
      supabase.from("poles").select("slug").eq("active", true),
      supabase.from("joueurs").select("slug, rosters(slug), poles(slug)").eq("active", true),
    ]);

    const urls: string[] = [];
    for (const r of (rostersRes.data ?? []) as { slug: string }[]) {
      urls.push(`/equipes/${r.slug}`);
    }
    for (const p of (polesRes.data ?? []) as { slug: string }[]) {
      urls.push(`/equipes/${p.slug}`);
    }
    for (const j of (joueursRes.data ?? []) as unknown as {
      slug: string;
      rosters: { slug: string } | null;
      poles: { slug: string } | null;
    }[]) {
      const parent = j.rosters?.slug ?? j.poles?.slug;
      if (parent) urls.push(`/equipes/${parent}/${j.slug}`);
    }
    return urls;
  },
  ["equipes-urls"],
  { tags: [CACHE_TAGS.equipes], revalidate: CACHE_TTL_SECONDS },
);
