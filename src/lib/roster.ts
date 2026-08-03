// Couche d'accès aux rosters et joueurs.
// Source : tables Supabase `rosters` et `joueurs` (lecture publique via RLS).
// Voir supabase/rosters_joueurs.sql pour le schéma.

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";
import { localizedText, localizedList, countryName } from "@/lib/localized";

/**
 * Joueur/membre prêt à afficher, dans UNE langue.
 *
 * `role` reste la valeur brute de la base (« Capitaine », « Coach »…) : c'est
 * une liste fermée, traduite à l'affichage via le catalogue `playerRoles`.
 * `pays`, lui, est déjà résolu ici — il est dérivé de `pays_code` par `Intl`,
 * donc aucun composant n'a à s'en occuper.
 */
export type Player = {
  id: string;
  slug: string;
  pseudo: string;
  nom: string | null;
  photo_url: string | null;
  pays: string | null;
  pays_code: string | null;
  role: string;
  bio: string | null;
  rang: string | null;
  mmr: number | null;
  twitter: string | null;
  twitch: string | null;
  rltracker: string | null;
  palmares: string[] | null;
  position: number;
};

/** Ligne brute de `joueurs`, les deux langues côte à côte. */
export type PlayerRow = Omit<Player, "palmares"> & {
  bio_en: string | null;
  palmares: string[] | null;
  palmares_en: string[] | null;
};

/** Ligne brute → joueur dans `locale`. */
export function localizePlayer(row: PlayerRow, locale: string): Player {
  const { bio_en, palmares_en, ...rest } = row;
  return {
    ...rest,
    // Nom du pays dérivé du code ISO : correct dans les deux langues, sans saisie.
    pays: countryName(row.pays_code, row.pays, locale),
    bio: localizedText(row.bio, bio_en, locale),
    palmares: localizedList(row.palmares, palmares_en, locale),
  };
}

export type Roster = {
  id: string;
  slug: string;
  name: string;
  rank: string | null;
  description: string | null;
  position: number;
  players: Player[];
};

const ROSTER_COLS = "id, slug, name, rank, description, description_en, position";

type RosterRow = Omit<Roster, "players"> & { description_en: string | null };

/** Tous les rosters actifs, ordonnés. Sans les joueurs (pour les listes). Cache : tag `equipes`. */
const fetchRosters = unstable_cache(
  async (): Promise<RosterRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("rosters")
      .select(ROSTER_COLS)
      .eq("active", true)
      .order("position", { ascending: true });

    if (error) {
      console.error("[rosters] select:", error.message);
      return [];
    }
    return (data ?? []) as RosterRow[];
  },
  ["rosters-list"],
  { tags: [CACHE_TAGS.equipes], revalidate: CACHE_TTL_SECONDS },
);

/** Rosters actifs dans `locale`, sans les joueurs. */
export async function getRosters(locale: string): Promise<Omit<Roster, "players">[]> {
  return (await fetchRosters()).map(({ description_en, ...r }) => ({
    ...r,
    description: localizedText(r.description, description_en, locale),
  }));
}

/**
 * Un roster + ses joueurs actifs (triés), ou null s'il n'existe pas.
 * - `unstable_cache` : partagé entre requêtes (tag `equipes`).
 * - `cache` (React) : mémoïsé dans un même rendu (generateMetadata + page = 1 appel).
 */
type RosterDetailRow = RosterRow & { players: PlayerRow[] | null };

const fetchRosterBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<RosterDetailRow | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("rosters")
        .select(`${ROSTER_COLS}, players:joueurs(*)`)
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        console.error("[roster] select:", error.message);
        return null;
      }
      return (data as unknown as RosterDetailRow) ?? null;
    },
    ["roster-by-slug"],
    { tags: [CACHE_TAGS.equipes], revalidate: CACHE_TTL_SECONDS },
  ),
);

/** Un roster + ses joueurs actifs (triés) dans `locale`, ou null s'il n'existe pas. */
export async function getRosterBySlug(
  slug: string,
  locale: string,
): Promise<Roster | null> {
  const row = await fetchRosterBySlug(slug);
  if (!row) return null;
  const { description_en, players, ...rest } = row;
  return {
    ...rest,
    description: localizedText(row.description, description_en, locale),
    players: (players ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => localizePlayer(p, locale)),
  };
}

/** Un joueur (via slug roster + slug joueur) accompagné de son roster. */
export const getPlayer = cache(
  async (
    rosterSlug: string,
    playerSlug: string,
    locale: string,
  ): Promise<{ player: Player; roster: Roster } | null> => {
    const roster = await getRosterBySlug(rosterSlug, locale);
    if (!roster) return null;
    const player = roster.players.find((p) => p.slug === playerSlug);
    if (!player) return null;
    return { player, roster };
  },
);

/** Code pays ISO alpha-2 → emoji drapeau (ex: "FR" → 🇫🇷). "" si invalide. */
export function flagEmoji(code?: string | null): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
