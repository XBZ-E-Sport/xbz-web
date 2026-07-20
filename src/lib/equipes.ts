// Couche data unifiée pour /equipes, les stats et le recrutement.
// Source : tables Supabase `rosters` (esport) + `poles` (staff/esport-staff).
// Le « rempli » de chaque groupe = nombre de membres (joueurs) réellement en
// base ; le « total » = colonne `capacity`. Slots 100 % dynamiques.

import { createClient } from "@/lib/supabase/server";
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
  fixed: boolean; variant: string; joueurs: CountRel;
};

function memberCount(rel: CountRel): number {
  return Array.isArray(rel) && rel[0] ? rel[0].count : 0;
}

async function fetchGroups(): Promise<{ rosters: Group[]; poles: Group[] }> {
  const supabase = await createClient();

  const [rostersRes, polesRes] = await Promise.all([
    supabase
      .from("rosters")
      .select("id, slug, name, description, position, capacity, recrute, joueurs(count)")
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase
      .from("poles")
      .select("id, slug, name, description, category, capacity, recrute, fixed, variant, position, joueurs(count)")
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
    isRoster: false,
  }));

  return { rosters, poles };
}

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
