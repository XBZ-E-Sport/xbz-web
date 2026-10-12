// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  order: null as { status: string; items: unknown } | null,
  readError: null as { message: string } | null,
  updates: [] as Record<string, unknown>[],
  updateRows: [{ id: "x" }] as unknown[],
  confirm: vi.fn(),
  filters: [] as [string, string, unknown][],
  /** Liste renvoyée par une lecture non `maybeSingle` (recherche de commande par numéro). */
  list: [] as unknown[],
  /** Erreurs successives des mises à jour (`null` = succès). */
  updateErrors: [] as ({ code?: string; message: string } | null)[],
}));

/** Faux client Supabase : une commande, ses mises à jour notées. */
vi.mock("@/lib/adminguard", () => ({
  assertStaff: async () => ({
    from: () => ({
      select: () => {
        const c: Record<string, unknown> = {};
        c.eq = (col: string, v: unknown) => {
          db.filters.push(["select", col, v]);
          return c;
        };
        for (const f of ["in", "gte", "lte", "order", "limit"]) {
          c[f] = (...a: unknown[]) => {
            db.filters.push(["select", f, a]);
            return c;
          };
        }
        c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: db.list, error: db.readError }).then(res);
        c.maybeSingle = async () => ({ data: db.order, error: db.readError });
        return c;
      },
      update: (values: Record<string, unknown>) => {
        db.updates.push(values);
        const c: Record<string, unknown> = {};
        c.eq = (col: string, v: unknown) => {
          db.filters.push(["update", col, v]);
          return c;
        };
        c.select = async () => {
          const error = db.updateErrors.shift() ?? null;
          return { data: error ? null : db.updateRows, error };
        };
        return c;
      },
    }),
  }),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/cache", async (orig) => ({ ...(await orig<typeof import("@/lib/cache")>()), revalidateLocalizedPath: vi.fn() }));
vi.mock("@/lib/order-confirmation", () => ({ sendOrderConfirmation: db.confirm }));
vi.mock("@/lib/withdrawal-server", () => ({ sendAck: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));

import { linkWithdrawalToOrder, markOrderShipped, resendOrderConfirmation, validateOrderPrints } from "./actions";

const ID = "0b6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const plain = { variant_id: "v1", name: "Mug", size: "", quantity: 1, unit_amount: 1499 };
const printed = (validated?: string) => ({
  variant_id: "v2",
  name: "Maillot",
  size: "M",
  quantity: 1,
  unit_amount: 5499,
  print: { name: "MARTIN", number: "10", extra: 500, ...(validated ? { validated_at: validated } : {}) },
});

beforeEach(() => {
  db.order = { status: "paid", items: [plain] };
  db.readError = null;
  db.updates.length = 0;
  db.filters.length = 0;
  db.list = [];
  db.updateErrors = [];
  db.updateRows = [{ id: "x" }];
  db.confirm.mockReset();
});

describe("validateOrderPrints — relecture des textes avant l'atelier", () => {
  it("date chaque article personnalisé non validé, sans toucher aux autres ni aux textes", async () => {
    db.order = { status: "paid", items: [plain, printed(), printed("2026-10-05T10:00:00.000Z")] };
    expect(await validateOrderPrints(form({ id: ID }))).toBeUndefined();
    expect(db.updates).toHaveLength(1);
    const items = db.updates[0].items as ReturnType<typeof printed>[];
    expect(items[0]).toEqual(plain);
    expect(typeof items[1].print.validated_at).toBe("string");
    expect(items[1].print).toMatchObject({ name: "MARTIN", number: "10", extra: 500 });
    // Une validation déjà faite garde SA date.
    expect(items[2].print.validated_at).toBe("2026-10-05T10:00:00.000Z");
  });

  it.each([
    ["aucun article personnalisé", { status: "paid", items: [plain] }, /aucun article personnalisé/],
    ["commande expédiée", { status: "fulfilled", items: [printed()] }, /payée et non expédiée/],
    ["commande en attente", { status: "pending", items: [printed()] }, /payée et non expédiée/],
    ["commande remboursée", { status: "refunded", items: [printed()] }, /payée et non expédiée/],
  ])("refusée : %s", async (_label, order, message) => {
    db.order = order;
    expect(await validateOrderPrints(form({ id: ID }))).toEqual({ error: expect.stringMatching(message) });
    expect(db.updates).toHaveLength(0);
  });

  it("identifiant invalide, commande disparue ou changée entre-temps : message, rien d'écrit", async () => {
    expect(await validateOrderPrints(form({ id: "pas-un-uuid" }))).toEqual({ error: expect.stringMatching(/invalide/) });
    db.order = null;
    expect(await validateOrderPrints(form({ id: ID }))).toEqual({ error: expect.stringMatching(/n'existe plus/) });
    db.order = { status: "paid", items: [printed()] };
    db.updateRows = [];
    expect(await validateOrderPrints(form({ id: ID }))).toEqual({ error: expect.stringMatching(/n'est plus « payée »/) });
  });
});

describe("markOrderShipped — pas d'expédition avant la relecture des textes", () => {
  it("texte NON validé : refusé, rien n'est écrit", async () => {
    db.order = { status: "paid", items: [plain, printed()] };
    const r = await markOrderShipped(form({ id: ID }));
    expect(r).toEqual({ error: expect.stringMatching(/texte n'est pas validé/) });
    expect(db.updates).toHaveLength(0);
  });

  it("texte validé : l'expédition passe", async () => {
    db.order = { status: "paid", items: [printed("2026-10-05T10:00:00.000Z")] };
    expect(await markOrderShipped(form({ id: ID }))).toBeUndefined();
    expect(db.updates[0]).toMatchObject({ status: "fulfilled" });
  });

  it("aucun article personnalisé : comme avant, rien à valider", async () => {
    expect(await markOrderShipped(form({ id: ID }))).toBeUndefined();
    expect(db.updates).toHaveLength(1);
  });

  it("une seule ligne non validée suffit à bloquer", async () => {
    db.order = { status: "paid", items: [printed("2026-10-05T10:00:00.000Z"), printed()] };
    expect(await markOrderShipped(form({ id: ID }))).toEqual({ error: expect.stringMatching(/pas validé/) });
  });

  it("lecture en erreur : refusée avec un message, jamais expédiée « dans le doute »", async () => {
    db.readError = { message: "boom" };
    const r = await markOrderShipped(form({ id: ID }));
    expect(r).toHaveProperty("error");
    expect(db.updates).toHaveLength(0);
  });
});

describe("garde-fous : les filtres sur le statut sont bien posés", () => {
  it("validation : l'écriture est limitée à une commande « payée » (le statut est aussi relu avant)", async () => {
    db.order = { status: "paid", items: [printed()] };
    await validateOrderPrints(form({ id: ID }));
    expect(db.filters).toContainEqual(["update", "status", "paid"]);
    expect(db.filters).toContainEqual(["update", "id", ID]);
  });

  it("expédition : lecture ET écriture limitées à une commande « payée »", async () => {
    db.order = { status: "paid", items: [plain] };
    await markOrderShipped(form({ id: ID }));
    expect(db.filters).toContainEqual(["select", "status", "paid"]);
    expect(db.filters).toContainEqual(["update", "status", "paid"]);
  });

  it("expédition d'une commande déjà expédiée ou remboursée (lecture vide) : aucune écriture réussie, message clair", async () => {
    db.order = null;
    db.updateRows = [];
    expect(await markOrderShipped(form({ id: ID }))).toEqual({ error: expect.stringMatching(/n'est plus/) });
  });

  it("lignes sans personnalisation ou items absents : rien à valider, pas de plantage", async () => {
    db.order = { status: "paid", items: null };
    expect(await markOrderShipped(form({ id: ID }))).toBeUndefined();
  });
});

describe("resendOrderConfirmation", () => {
  it("renvoie de force et réussit en silence", async () => {
    db.confirm.mockResolvedValue({ sent: true });
    expect(await resendOrderConfirmation(form({ id: ID }))).toBeUndefined();
    expect(db.confirm).toHaveBeenCalledWith(expect.anything(), ID, { force: true });
  });

  it("échec : le motif est dit au staff", async () => {
    db.confirm.mockResolvedValue({ sent: false, error: "Brevo HTTP 401" });
    expect(await resendOrderConfirmation(form({ id: ID }))).toEqual({ error: "Confirmation non envoyée : Brevo HTTP 401." });
  });

  it("identifiant invalide : refusé AVANT tout envoi", async () => {
    expect(await resendOrderConfirmation(form({ id: "x" }))).toEqual({ error: expect.stringMatching(/invalide/) });
    expect(db.confirm).not.toHaveBeenCalled();
  });
});

describe("linkWithdrawalToOrder — rattachement manuel d'une rétractation", () => {
  const W = "1c6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";

  it("cherche la commande par son numéro dans TOUTE la base (plage d'identifiants), et marque le rattachement « manual »", async () => {
    db.list = [{ id: ID }];
    expect(await linkWithdrawalToOrder(form({ id: W, numero: "xbz-0b6f1d3e" }))).toBeUndefined();
    expect(db.filters).toContainEqual(["select", "gte", ["id", "0b6f1d3e-0000-0000-0000-000000000000"]]);
    expect(db.filters).toContainEqual(["select", "lte", ["id", "0b6f1d3e-ffff-ffff-ffff-ffffffffffff"]]);
    // Plus de limite aux 1 000 dernières commandes.
    expect(db.filters.filter(([, f, a]) => f === "limit" && Array.isArray(a) && (a as number[])[0] === 1000)).toHaveLength(0);
    expect(db.updates).toEqual([{ order_id: ID, match: "manual" }]);
  });

  it("migration pas passée (contrainte sur match) : retombe sur « exact », comme avant", async () => {
    db.list = [{ id: ID }];
    db.updateErrors = [{ code: "23514", message: "violates check constraint" }];
    expect(await linkWithdrawalToOrder(form({ id: W, numero: "XBZ-0B6F1D3E" }))).toBeUndefined();
    expect(db.updates).toEqual([
      { order_id: ID, match: "manual" },
      { order_id: ID, match: "exact" },
    ]);
  });

  it("numéro inconnu, invalide, ou porté par deux commandes : message clair, rien d'écrit", async () => {
    expect(await linkWithdrawalToOrder(form({ id: W, numero: "XBZ-0B6F1D3E" }))).toEqual({ error: expect.stringMatching(/Aucune commande payée/) });
    expect(await linkWithdrawalToOrder(form({ id: W, numero: "pas un numéro" }))).toEqual({ error: expect.stringMatching(/invalide/) });
    db.list = [{ id: ID }, { id: "0b6f1d3e-0000-4000-8000-000000000000" }];
    expect(await linkWithdrawalToOrder(form({ id: W, numero: "XBZ-0B6F1D3E" }))).toEqual({ error: expect.stringMatching(/Plusieurs commandes/) });
    expect(db.updates).toHaveLength(0);
  });
});
