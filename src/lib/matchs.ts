// Couche d'accès au calendrier & résultats des matchs.
// Source : table Supabase `matchs` (lecture publique des matchs actifs, via RLS
// active = true), rattachés à un roster XBZ.
//
// Le résultat (victoire/défaite/nul) est DÉRIVÉ des scores, jamais stocké.

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";

export const matchStatuses = ["scheduled", "finished", "cancelled"] as const;
export type MatchStatus = (typeof matchStatuses)[number];

export const matchFormats = ["BO1", "BO3", "BO5", "BO7"] as const;

export type MatchResult = "win" | "loss" | "draw";

export type Match = {
  id: string;
  rosterId: string | null;
  opponent: string;
  opponentLogo: string | null;
  competition: string;
  format: string;
  startsAt: string; // heure murale FR, sans fuseau (ex. "2026-09-20T18:00:00")
  status: MatchStatus;
  scoreXbz: number | null;
  scoreOpponent: number | null;
  streamUrl: string | null;
  roster: { slug: string; name: string } | null;
  result: MatchResult | null;
};

const MATCH_COLS =
  "id, roster_id, opponent, opponent_logo, competition, format, starts_at, status, " +
  "score_xbz, score_opponent, stream_url, rosters(slug, name)";

function normalizeStatus(value: string): MatchStatus {
  return (matchStatuses as readonly string[]).includes(value)
    ? (value as MatchStatus)
    : "scheduled";
}

function normalizeFormat(value: string): string {
  return (matchFormats as readonly string[]).includes(value) ? value : "BO3";
}

/** Résultat déduit des scores (uniquement pour un match terminé et chiffré). */
function deriveResult(
  status: MatchStatus,
  xbz: number | null,
  opp: number | null,
): MatchResult | null {
  if (status !== "finished" || xbz === null || opp === null) return null;
  if (xbz > opp) return "win";
  if (xbz < opp) return "loss";
  return "draw";
}

type MatchRow = {
  id: string;
  roster_id: string | null;
  opponent: string;
  opponent_logo: string | null;
  competition: string | null;
  format: string;
  starts_at: string;
  status: string;
  score_xbz: number | null;
  score_opponent: number | null;
  stream_url: string | null;
  // Supabase renvoie la relation embarquée sous forme d'objet (ou null).
  rosters: { slug: string; name: string } | null;
};

function toMatch(row: MatchRow): Match {
  const status = normalizeStatus(row.status);
  return {
    id: row.id,
    rosterId: row.roster_id ?? null,
    opponent: row.opponent,
    opponentLogo: row.opponent_logo ?? null,
    competition: row.competition ?? "",
    format: normalizeFormat(row.format),
    startsAt: row.starts_at,
    status,
    scoreXbz: row.score_xbz,
    scoreOpponent: row.score_opponent,
    streamUrl: row.stream_url ?? null,
    roster: row.rosters ?? null,
    result: deriveResult(status, row.score_xbz, row.score_opponent),
  };
}

/** Lecture brute, mise en cache, triée par date croissante. */
const fetchMatchRows = unstable_cache(
  async (): Promise<MatchRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("matchs")
      .select(MATCH_COLS)
      .eq("active", true)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[matchs] select:", error.message);
      return [];
    }
    return (data ?? []) as unknown as MatchRow[];
  },
  ["matchs-list"],
  { tags: [CACHE_TAGS.matchs], revalidate: CACHE_TTL_SECONDS },
);

/**
 * Deux tableaux prêts à afficher :
 *  - `upcoming` : matchs pas encore terminés (à venir + annulés), du plus proche
 *    au plus lointain. On se base sur le STATUT, pas sur la date : une page ISR
 *    fige « maintenant » au build, un filtre par date serait donc faux. C'est le
 *    staff qui bascule un match en « terminé » une fois joué.
 *  - `results` : matchs terminés, du plus récent au plus ancien.
 */
export async function getMatchBoards(): Promise<{ upcoming: Match[]; results: Match[] }> {
  const rows = (await fetchMatchRows()).map(toMatch);
  const upcoming = rows.filter((m) => m.status !== "finished");
  const results = rows.filter((m) => m.status === "finished").reverse();
  return { upcoming, results };
}

/**
 * Les matchs d'UN roster (à venir + résultats), pour sa page d'équipe. Dérivé
 * du même cache que le calendrier — pas de requête supplémentaire.
 */
export async function getRosterMatchBoards(
  rosterId: string,
): Promise<{ upcoming: Match[]; results: Match[] }> {
  const rows = (await fetchMatchRows()).map(toMatch).filter((m) => m.rosterId === rosterId);
  const upcoming = rows.filter((m) => m.status !== "finished");
  const results = rows.filter((m) => m.status === "finished").reverse();
  return { upcoming, results };
}

/** Le prochain match programmé (bandeau d'accueil), ou null s'il n'y en a pas. */
export async function getNextMatch(): Promise<Match | null> {
  const rows = (await fetchMatchRows()).map(toMatch);
  return rows.find((m) => m.status === "scheduled") ?? null;
}

/**
 * Date + heure d'un match, formatées dans la langue, SANS conversion de fuseau.
 *
 * `starts_at` est une heure murale française stockée sans fuseau. On l'interprète
 * en UTC puis on l'affiche en UTC : la valeur saisie au back-office ressort donc
 * à l'identique (18:00 saisi → 18:00 affiché), sans dérive d'heure d'été.
 */
export function formatMatchDateTime(value: string, locale: string): string {
  const norm = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(norm.endsWith("Z") ? norm : `${norm}Z`);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}
