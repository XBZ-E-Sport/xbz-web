// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  order: null as { status: string; items: unknown } | null,
  readError: null as { message: string } | null,
  updates: [] as Record<string, unknown>[],
  updateRows: [{ id: "x" }] as unknown[],
  confirm: vi.fn(),
}));

/** Faux client Supabase : une commande, ses mises à jour notées. */
vi.mock("@/lib/adminguard", () => ({
  assertStaff: async () => ({
    from: () => ({
      select: () => {
        const c: Record<string, unknown> = {};
        c.eq = () => c;
        c.maybeSingle = async () => ({ data: db.order, error: db.readError });
        return c;
      },
      update: (values: Record<string, unknown>) => {
        db.updates.push(values);
        const c: Record<string, unknown> = {};
        c.eq = () => c;
        c.select = async () => ({ data: db.updateRows, error: null });
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

import { markOrderShipped, resendOrderConfirmation, validateOrderPrints } from "./actions";

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
