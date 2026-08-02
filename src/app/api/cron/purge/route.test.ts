// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Table → lignes supprimées (pilotées par test).
const { deleted, deleteCalls, errorFor } = vi.hoisted(() => ({
  deleted: { value: {} as Record<string, unknown[]> },
  deleteCalls: { value: [] as { table: string; cutoff: string }[] },
  errorFor: { value: null as string | null },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      delete: () => ({
        lt: (_col: string, cutoff: string) => ({
          select: async () => {
            deleteCalls.value.push({ table, cutoff });
            if (errorFor.value === table) return { data: null, error: { message: "boom" } };
            return { data: deleted.value[table] ?? [], error: null };
          },
        }),
      }),
    }),
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

import { GET } from "@/app/api/cron/purge/route";

const call = (auth?: string) =>
  GET(new Request("https://x.test/api/cron/purge", auth ? { headers: { authorization: auth } } : {}));

describe("GET /api/cron/purge", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    deleted.value = {};
    deleteCalls.value = [];
    errorFor.value = null;
  });

  it("refuse l'appel quand CRON_SECRET n'est pas configuré (fail-safe)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await call("Bearer peu-importe");
    expect(res.status).toBe(401);
    // Aucune suppression ne doit avoir été tentée.
    expect(deleteCalls.value).toHaveLength(0);
  });

  it("refuse un jeton absent ou incorrect", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer mauvais")).status).toBe(401);
    expect(deleteCalls.value).toHaveLength(0);
  });

  it("purge les 3 tables avec le bon jeton et compte les lignes", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    deleted.value = {
      candidatures: [{ id: 1 }, { id: 2 }],
      support_messages: [{ id: 3 }],
      rate_limit_hits: [{ id: 4 }, { id: 5 }, { id: 6 }],
    };

    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.retentionMonths).toBe(24);
    expect(json.deleted).toEqual({
      candidatures: 2,
      support_messages: 1,
      rate_limit_hits: 3,
    });
    expect(deleteCalls.value.map((c) => c.table)).toEqual([
      "candidatures",
      "support_messages",
      "rate_limit_hits",
    ]);
  });

  it("supprime les données perso à 24 mois et les IP anti-flood à 1 heure", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    await call("Bearer s3cret");

    const byTable = Object.fromEntries(deleteCalls.value.map((c) => [c.table, new Date(c.cutoff)]));
    const now = Date.now();
    const months = (now - byTable.candidatures.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const hours = (now - byTable.rate_limit_hits.getTime()) / (1000 * 60 * 60);

    expect(months).toBeGreaterThan(23.5);
    expect(months).toBeLessThan(24.5);
    expect(hours).toBeCloseTo(1, 1);
  });

  it("renvoie 500 si une suppression échoue", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    errorFor.value = "support_messages";

    const res = await call("Bearer s3cret");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("support_messages");
  });
});
