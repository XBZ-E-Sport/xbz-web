// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Chemin réel des données : requête Supabase → mapper → tableaux affichables.
 * On vérifie le tri par statut (à venir / résultats), la dérivation du résultat
 * (V/D/N depuis les scores), et le formatage de l'heure sans dérive de fuseau.
 */

const { rows, selected } = vi.hoisted(() => ({
  rows: { value: [] as unknown[] },
  selected: { value: "" },
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: () => ({
      select: (cols: string) => {
        selected.value = cols;
        const chain = {
          eq: () => chain,
          order: () => chain,
          then: (resolve: (v: { data: unknown; error: null }) => void) =>
            resolve({ data: rows.value, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const { getMatchBoards, getRosterMatchBoards, getNextMatch, formatMatchDateTime } = await import(
  "@/lib/matchs"
);

const base = {
  opponent: "Rivals",
  opponent_logo: null,
  competition: "Coupe",
  format: "BO3",
  stream_url: null,
  rosters: { slug: "ssl", name: "Roster SSL" },
};

beforeEach(() => {
  rows.value = [];
  selected.value = "";
});

describe("matchs", () => {
  it("demande la relation roster et les scores", async () => {
    rows.value = [{ ...base, id: "1", starts_at: "2026-09-20T18:00:00", status: "scheduled", score_xbz: null, score_opponent: null }];
    await getMatchBoards();
    for (const col of ["rosters(", "score_xbz", "starts_at"]) {
      expect(selected.value).toContain(col);
    }
  });

  it("sépare à venir (statut ≠ terminé) et résultats (terminés)", async () => {
    rows.value = [
      { ...base, id: "a", starts_at: "2026-09-10T18:00:00", status: "finished", score_xbz: 3, score_opponent: 1 },
      { ...base, id: "b", starts_at: "2026-09-20T18:00:00", status: "scheduled", score_xbz: null, score_opponent: null },
      { ...base, id: "c", starts_at: "2026-09-25T18:00:00", status: "cancelled", score_xbz: null, score_opponent: null },
    ];
    const { upcoming, results } = await getMatchBoards();
    expect(upcoming.map((m) => m.id)).toEqual(["b", "c"]); // scheduled + cancelled, ordre date
    expect(results.map((m) => m.id)).toEqual(["a"]); // terminés
  });

  it("classe les résultats du plus récent au plus ancien", async () => {
    rows.value = [
      { ...base, id: "old", starts_at: "2026-09-01T18:00:00", status: "finished", score_xbz: 3, score_opponent: 0 },
      { ...base, id: "new", starts_at: "2026-09-15T18:00:00", status: "finished", score_xbz: 2, score_opponent: 3 },
    ];
    const { results } = await getMatchBoards();
    expect(results.map((m) => m.id)).toEqual(["new", "old"]);
  });

  it("dérive le résultat depuis les scores d'un match terminé", async () => {
    rows.value = [
      { ...base, id: "w", starts_at: "2026-09-01T18:00:00", status: "finished", score_xbz: 3, score_opponent: 1 },
      { ...base, id: "l", starts_at: "2026-09-02T18:00:00", status: "finished", score_xbz: 1, score_opponent: 3 },
      { ...base, id: "d", starts_at: "2026-09-03T18:00:00", status: "finished", score_xbz: 2, score_opponent: 2 },
    ];
    const { results } = await getMatchBoards();
    const byId = Object.fromEntries(results.map((m) => [m.id, m.result]));
    expect(byId).toEqual({ w: "win", l: "loss", d: "draw" });
  });

  it("ne dérive pas de résultat pour un match non terminé", async () => {
    rows.value = [{ ...base, id: "b", starts_at: "2026-09-20T18:00:00", status: "scheduled", score_xbz: null, score_opponent: null }];
    const { upcoming } = await getMatchBoards();
    expect(upcoming[0].result).toBeNull();
  });

  it("getNextMatch renvoie le premier match programmé (ni annulé ni terminé)", async () => {
    rows.value = [
      { ...base, id: "past", starts_at: "2026-09-01T18:00:00", status: "finished", score_xbz: 3, score_opponent: 0 },
      { ...base, id: "next", starts_at: "2026-09-20T18:00:00", status: "scheduled", score_xbz: null, score_opponent: null },
    ];
    expect((await getNextMatch())?.id).toBe("next");
  });

  it("getRosterMatchBoards ne renvoie que les matchs du roster demandé", async () => {
    rows.value = [
      { ...base, id: "a", roster_id: "r1", starts_at: "2026-09-10T18:00:00", status: "finished", score_xbz: 3, score_opponent: 1 },
      { ...base, id: "b", roster_id: "r1", starts_at: "2026-09-20T18:00:00", status: "scheduled", score_xbz: null, score_opponent: null },
      { ...base, id: "c", roster_id: "r2", starts_at: "2026-09-21T18:00:00", status: "scheduled", score_xbz: null, score_opponent: null },
    ];
    const { upcoming, results } = await getRosterMatchBoards("r1");
    expect(upcoming.map((m) => m.id)).toEqual(["b"]);
    expect(results.map((m) => m.id)).toEqual(["a"]);
  });

  it("formate l'heure sans dérive de fuseau (18:00 saisi → 18:00 affiché)", () => {
    const out = formatMatchDateTime("2026-09-20T18:00:00", "fr");
    expect(out).toContain("18:00");
    expect(out).toContain("20");
  });
});
