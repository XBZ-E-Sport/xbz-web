// Couche d'accès aux rosters et joueurs.
// Source : tables Supabase `rosters` et `joueurs` (lecture publique via RLS).
// Voir supabase/rosters_joueurs.sql pour le schéma.

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

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

export type Roster = {
  id: string;
  slug: string;
  name: string;
  rank: string | null;
  description: string | null;
  position: number;
  players: Player[];
};

const ROSTER_COLS = "id, slug, name, rank, description, position";

/** Tous les rosters actifs, ordonnés. Sans les joueurs (pour les listes). */
export async function getRosters(): Promise<Omit<Roster, "players">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rosters")
    .select(ROSTER_COLS)
    .eq("active", true)
    .order("position", { ascending: true });

  if (error) {
    console.error("[rosters] select:", error.message);
    return [];
  }
  return (data ?? []) as Omit<Roster, "players">[];
}

/**
 * Un roster + ses joueurs actifs (triés), ou null s'il n'existe pas.
 * Mémoïsé par requête (`cache`) : generateMetadata + la page ne font qu'un appel.
 */
export const getRosterBySlug = cache(async (slug: string): Promise<Roster | null> => {
  const supabase = await createClient();
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
  if (!data) return null;

  const roster = data as Roster;
  roster.players = (roster.players ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  return roster;
});

/** Un joueur (via slug roster + slug joueur) accompagné de son roster. */
export const getPlayer = cache(
  async (
    rosterSlug: string,
    playerSlug: string,
  ): Promise<{ player: Player; roster: Roster } | null> => {
    const roster = await getRosterBySlug(rosterSlug);
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
