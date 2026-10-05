// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Table → lignes supprimées (pilotées par test).
const { deleted, deleteCalls, errorFor, errorCode, retryAcks } = vi.hoisted(() => ({
  deleted: { value: {} as Record<string, unknown[]> },
  deleteCalls: { value: [] as { table: string; cutoff: string; eq: [string, unknown][] }[] },
  errorFor: { value: null as string | null },
  errorCode: { value: undefined as string | undefined },
  retryAcks: vi.fn(async () => 0),
}));

// Filet des accusés de rétractation : testé dans src/lib/withdrawal-server.test.ts.
vi.mock("@/lib/withdrawal-server", () => ({ retryPendingAcks: retryAcks }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      delete: () => {
        const eq: [string, unknown][] = [];
        const chain = {
          eq: (col: string, value: unknown) => {
            eq.push([col, value]);
            return chain;
          },
          lt: (_col: string, cutoff: string) => ({
            select: async () => {
              deleteCalls.value.push({ table, cutoff, eq });
              if (errorFor.value === table) return { data: null, error: { message: "boom", code: errorCode.value } };
              return { data: deleted.value[table] ?? [], error: null };
            },
          }),
        };
        return chain;
      },
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
    errorCode.value = undefined;
    retryAcks.mockClear();
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
      order_withdrawals: 0,
    });
    expect(deleteCalls.value.map((c) => c.table)).toEqual([
      "candidatures",
      "support_messages",
      "order_withdrawals",
      "order_withdrawals",
      "rate_limit_hits",
    ]);
  });

  it("rétractations : supprimées à 5 ans ; celles au piège anti-bot rempli, à 30 jours", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    deleted.value = { order_withdrawals: [{ id: 1 }] };
    const json = await (await call("Bearer s3cret")).json();
    expect(json.deleted.order_withdrawals).toBe(2); // une ligne par suppression (mock identique)

    const [old, suspect] = deleteCalls.value.filter((c) => c.table === "order_withdrawals");
    const years = (Date.now() - new Date(old.cutoff).getTime()) / (1000 * 3600 * 24 * 365.25);
    expect(years).toBeGreaterThan(4.99);
    expect(years).toBeLessThan(5.01);
    expect(old.eq).toEqual([]); // TOUTES les déclarations de plus de 5 ans, pas seulement les suspectes

    const days = (Date.now() - new Date(suspect.cutoff).getTime()) / (1000 * 3600 * 24);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(suspect.eq).toEqual([["suspect", true]]); // JAMAIS une vraie déclaration à 30 jours
  });

  it("table des rétractations absente (migration pas passée) ou en erreur : le reste de la purge continue", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.spyOn(console, "error").mockImplementation(() => {});
    errorFor.value = "order_withdrawals";

    errorCode.value = "42P01";
    expect((await call("Bearer s3cret")).status).toBe(200);
    errorCode.value = "XX000";
    expect((await call("Bearer s3cret")).status).toBe(200);
    expect(deleteCalls.value.map((c) => c.table)).toContain("rate_limit_hits");
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

  it("relance au passage les accusés de rétractation restés sans réponse, et le dit dans le bilan", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    retryAcks.mockResolvedValueOnce(2);
    const body = await (await call("Bearer s3cret")).json();
    expect(retryAcks).toHaveBeenCalledTimes(1);
    expect(body.withdrawalAcksSent).toBe(2);
  });
});
