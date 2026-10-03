// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

const h = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  pages: [] as { data: unknown[] | null; error: { message: string } | null }[],
  filters: [] as [string, unknown[]][],
  ranges: [] as [number, number][],
}));

vi.mock("@/lib/adminguard", () => ({ requireStaff: h.requireStaff }));
vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

import { GET } from "./route";

/** Faux client Supabase : chaque `.range()` consomme la page suivante préparée par le test. */
const admin = {
  from: (table: string) => {
    expect(table).toBe("orders");
    const chain: Record<string, unknown> = {};
    for (const f of ["select", "in", "gte", "lt", "order"]) {
      chain[f] = (...a: unknown[]) => {
        h.filters.push([f, a]);
        return chain;
      };
    }
    chain.range = (from: number, to: number) => {
      h.ranges.push([from, to]);
      return Promise.resolve(h.pages.shift() ?? { data: [], error: null });
    };
    return chain;
  },
};

const row = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  status: "paid",
  items: [{ variant_id: "v", product_id: "p", slug: "mug", name: "Mug XBZ", size: "", quantity: 1, unit_amount: 1499, image: null }],
  subtotal: "14.99",
  shipping: "4.90",
  currency: "eur",
  amount_total: "19.89",
  customer_email: "client@example.fr",
  customer_name: "Camille Durand",
  shipping_address: { line1: "1 rue Test", postal_code: "75001", city: "Paris", country: "FR" },
  stripe_payment_intent: `pi_${n}`,
  paid_at: "2026-09-15T10:00:00Z",
  ...over,
});

const call = (qs = "du=2026-09-01&au=2026-09-30") => GET(new Request(`https://www.xbz-esport.org/fr/admin/commandes/export?${qs}`));

beforeEach(() => {
  h.requireStaff.mockReset();
  h.requireStaff.mockResolvedValue({ user: { id: "u1", email: "staff@xbz.gg" }, admin });
  h.pages = [];
  h.filters = [];
  h.ranges = [];
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("export des commandes — accès", () => {
  it("sans session staff : la garde redirige AVANT toute lecture de la base", async () => {
    h.requireStaff.mockImplementation(async () => redirect("/fr/login"));
    await expect(call()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(h.ranges).toEqual([]);
    expect(h.filters).toEqual([]);
  });

  it("une période invalide est refusée en 400, sans lire la base", async () => {
    const res = await call("du=2026-09-30&au=2026-09-01");
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/après la date de fin/);
    expect(h.ranges).toEqual([]);
  });
});

describe("export des commandes — fichier", () => {
  it("renvoie un CSV à télécharger, jamais mis en cache", async () => {
    h.pages = [{ data: [row(1)], error: null }];
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="xbz-commandes_2026-09-01_2026-09-30.csv"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("XBZ-00000000");
    expect(text).toContain("19,89");
  });

  it("ne lit que les commandes encaissées, dans la période (heure de Paris), triées", async () => {
    h.pages = [{ data: [], error: null }];
    await call("du=2026-09-01&au=2026-09-30");
    expect(h.filters).toContainEqual(["in", ["status", ["paid", "fulfilled", "refunded"]]]);
    expect(h.filters).toContainEqual(["gte", ["paid_at", "2026-08-31T22:00:00.000Z"]]);
    expect(h.filters).toContainEqual(["lt", ["paid_at", "2026-09-30T22:00:00.000Z"]]);
    expect(h.filters.filter(([f]) => f === "order").map(([, a]) => a[0])).toEqual(["paid_at", "id"]);
  });

  it("sans perso=1, rien de personnel ne quitte le serveur dans le fichier", async () => {
    h.pages = [{ data: [row(1)], error: null }];
    const text = await (await call()).text();
    for (const secret of ["client@example.fr", "Camille", "Durand", "rue Test", "75001"]) expect(text).not.toContain(secret);
  });

  it("avec perso=1, les données personnelles sont là — et tracées dans les journaux", async () => {
    h.pages = [{ data: [row(1)], error: null }];
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const text = await (await call("du=2026-09-01&au=2026-09-30&perso=1")).text();
    expect(text).toContain("client@example.fr");
    const logged = String(info.mock.calls[0].join(" "));
    expect(logged).toContain("staff@xbz.gg");
    expect(logged).toContain('"perso":true');
    // Le journal dit QUI a exporté, jamais ce qui a été exporté.
    expect(logged).not.toContain("client@example.fr");
    expect(logged).not.toContain("Camille");
  });

  it("lit TOUTES les pages (PostgREST plafonne à 1 000 lignes par réponse)", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => row(i + 1));
    const page2 = Array.from({ length: 5 }, (_, i) => row(1001 + i));
    h.pages = [
      { data: page1, error: null },
      { data: page2, error: null },
    ];
    const res = await call();
    expect(h.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(1 + 1005); // en-tête + commandes
  });

  it("exactement 1 000 commandes : une page pleine, puis une page vide, rien de perdu ni de doublé", async () => {
    h.pages = [
      { data: Array.from({ length: 1000 }, (_, i) => row(i + 1)), error: null },
      { data: [], error: null },
    ];
    const lines = (await (await call()).text()).trim().split("\r\n");
    expect(lines).toHaveLength(1001);
  });

  it("trop de commandes : 413 avec consigne, pas un fichier tronqué en silence", async () => {
    h.pages = Array.from({ length: 11 }, (_, p) => ({ data: Array.from({ length: 1000 }, (_, i) => row(p * 1000 + i + 1)), error: null }));
    const res = await call();
    expect(res.status).toBe(413);
    expect(await res.text()).toMatch(/réduis les dates/);
  });

  it("erreur de base : 500 générique, détail dans les journaux seulement", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    h.pages = [{ data: null, error: { message: 'relation "orders" does not exist (10.0.0.3)' } }];
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("10.0.0.3");
    expect(String(err.mock.calls[0].join(" "))).toContain("10.0.0.3");
  });

  it("export par article", async () => {
    h.pages = [{ data: [row(1)], error: null }];
    const res = await call("du=2026-09-01&au=2026-09-30&detail=articles");
    expect(res.headers.get("content-disposition")).toContain("xbz-articles_");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(1 + 2); // un article + le port
  });
});
