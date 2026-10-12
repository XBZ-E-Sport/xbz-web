// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const stripeMock = vi.hoisted(() => ({
  checkout: { sessions: { expire: vi.fn(), retrieve: vi.fn() } },
  paymentIntents: { retrieve: vi.fn() },
  charges: { retrieve: vi.fn() },
}));
vi.mock("@/lib/stripe", () => ({ stripe: () => stripeMock }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
const confirmation = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/order-confirmation", () => ({ sendOrderConfirmationAfterResponse: confirmation.send }));

import {
  abandonOrder,
  buildCheckoutParams,
  orderNumber,
  recordPayment,
  recordRefund,
  releaseFromSession,
  reserveOrder,
  shippingEuros,
  sweepStaleReservations,
  type Order,
} from "@/lib/shop";

/** Faux client Supabase : chaque appel est noté ; les réponses sont réglées par test. */
function fakeAdmin(opts: {
  rpc?: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown };
  select?: (table: string, cols: string) => { data: unknown; error?: unknown };
  update?: { error: unknown; data?: unknown } | ((values: Record<string, unknown>) => { error: unknown; data?: unknown });
}) {
  const calls: { op: string; table?: string; args?: unknown; filters: [string, unknown][] }[] = [];
  const chain = (call: (typeof calls)[number], result: () => unknown) => {
    const c: Record<string, unknown> = {};
    for (const f of ["select", "eq", "in", "lt", "or", "order", "limit"]) {
      c[f] = (...a: unknown[]) => {
        call.filters.push([f, a]);
        return c;
      };
    }
    c.maybeSingle = () => Promise.resolve(result());
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return c;
  };
  return {
    calls,
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ op: `rpc:${name}`, args, filters: [] });
      return Promise.resolve(opts.rpc?.(name, args) ?? { data: null, error: null });
    },
    from: (table: string) => ({
      select: (cols: string) => {
        const call = { op: "select", table, args: cols, filters: [] as [string, unknown][] };
        calls.push(call);
        return chain(call, () => opts.select?.(table, cols) ?? { data: null, error: null });
      },
      update: (values: unknown) => {
        const call = { op: "update", table, args: values, filters: [] as [string, unknown][] };
        calls.push(call);
        return chain(call, () => (typeof opts.update === "function" ? opts.update(values as Record<string, unknown>) : (opts.update ?? { error: null })));
      },
    }),
  };
}
type Admin = Parameters<typeof reserveOrder>[0];

const ORDER_ID = "0b6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";
const order: Order = {
  id: ORDER_ID,
  status: "pending",
  items: [
    { variant_id: "v-m", product_id: "p1", slug: "maillot", name: "Maillot officiel XBZ", size: "M", quantity: 2, unit_amount: 4999, image: "https://cdn.test/maillot.webp" },
    { variant_id: "v-u", product_id: "p2", slug: "mug", name: "Mug XBZ", size: "", quantity: 1, unit_amount: 1499, image: null },
  ],
  subtotal: "114.97",
  shipping: "4.90",
  currency: "eur",
  locale: "fr",
  expires_at: "2026-10-01T12:32:00.000Z",
  stripe_session_id: null,
  stripe_payment_intent: null,
  amount_total: null,
  customer_email: null,
  customer_name: null,
  shipping_address: null,
  note: null,
  created_at: "2026-10-01T12:00:00.000Z",
  paid_at: null,
  fulfilled_at: null,
  cancelled_at: null,
  refunded_at: null,
};
const texts = {
  size: (s: string) => `taille ${s}`,
  print: (p: { name?: string; number?: string; extra: number }) => `perso ${p.name ?? ""} ${p.number ?? ""} +${p.extra}`.replace(/ +/g, " ").trim(),
  shipping: "Livraison standard",
  submit: "Commande avec obligation de paiement.",
};

beforeEach(() => {
  stripeMock.checkout.sessions.expire.mockReset();
  stripeMock.checkout.sessions.retrieve.mockReset();
  stripeMock.paymentIntents.retrieve.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("réglages", () => {
  it("frais de port : défaut 4,90 €, réglables, jamais négatifs ni illisibles", () => {
    vi.stubEnv("SHIPPING_FLAT_EUR", undefined as unknown as string);
    expect(shippingEuros()).toBe(4.9);
    vi.stubEnv("SHIPPING_FLAT_EUR", "6,5");
    expect(shippingEuros()).toBe(6.5);
    vi.stubEnv("SHIPPING_FLAT_EUR", "0");
    expect(shippingEuros()).toBe(0);
    vi.stubEnv("SHIPPING_FLAT_EUR", "-3");
    expect(shippingEuros()).toBe(4.9);
    vi.stubEnv("SHIPPING_FLAT_EUR", "gratuit");
    expect(shippingEuros()).toBe(4.9);
  });

  it("numéro de commande lisible et stable", () => {
    expect(orderNumber(ORDER_ID)).toBe("XBZ-0B6F1D3E");
  });
});

describe("buildCheckoutParams", () => {
  const p = buildCheckoutParams(order, texts);

  it("reprend EXACTEMENT les lignes figées par la base (prix, quantités, tailles)", () => {
    expect(p.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: "eur",
          unit_amount: 4999,
          product_data: { name: "Maillot officiel XBZ — taille M", images: ["https://cdn.test/maillot.webp"], metadata: { variant_id: "v-m" } },
        },
      },
      {
        quantity: 1,
        price_data: { currency: "eur", unit_amount: 1499, product_data: { name: "Mug XBZ", metadata: { variant_id: "v-u" } } },
      },
    ]);
  });

  it("port, pays, carte seule, expiration = fin de la réservation", () => {
    expect(p.shipping_options?.[0]?.shipping_rate_data?.fixed_amount).toEqual({ amount: 490, currency: "eur" });
    expect(p.shipping_address_collection?.allowed_countries).toContain("FR");
    expect(p.payment_method_types).toEqual(["card"]);
    expect(p.expires_at).toBe(Math.floor(Date.parse(order.expires_at!) / 1000));
  });

  it("relie la session et le paiement à la commande", () => {
    expect(p.client_reference_id).toBe(ORDER_ID);
    expect(p.metadata).toEqual({ order_id: ORDER_ID });
    expect(p.payment_intent_data?.metadata).toEqual({ order_id: ORDER_ID, order_number: "XBZ-0B6F1D3E" });
  });

  it("retours vers le site, dans la langue de la commande", () => {
    expect(p.success_url).toMatch(/\/fr\/boutique\/merci\?session_id=\{CHECKOUT_SESSION_ID\}$/);
    expect(p.cancel_url).toMatch(/\/fr\/boutique\/panier\?annule=1$/);
    const en = buildCheckoutParams({ ...order, locale: "en" }, texts);
    expect(en.locale).toBe("en");
    expect(en.success_url).toMatch(/\/en\/boutique\/merci/);
  });

  it("n'envoie pas d'image non HTTPS à Stripe", () => {
    const q = buildCheckoutParams({ ...order, items: [{ ...order.items[0], image: "http://x.test/a.png" }] }, texts);
    expect(q.line_items?.[0]?.price_data?.product_data).not.toHaveProperty("images");
  });

  it("article personnalisé : prix unitaire PAYÉ (supplément compris) et texte imprimé en description", () => {
    const printed = { ...order.items[0], quantity: 1, unit_amount: 5499, print: { name: "MARTIN", number: "10", extra: 500 } };
    const q = buildCheckoutParams({ ...order, items: [order.items[0], printed] }, texts);
    expect(q.line_items?.[1]?.price_data?.unit_amount).toBe(5499);
    expect(q.line_items?.[1]?.price_data?.product_data).toMatchObject({
      name: "Maillot officiel XBZ — taille M",
      description: "perso MARTIN 10 +500",
      metadata: { variant_id: "v-m" },
    });
    // L'article ordinaire de la même taille garde son prix et n'a pas de description.
    expect(q.line_items?.[0]?.price_data?.unit_amount).toBe(4999);
    expect(q.line_items?.[0]?.price_data?.product_data).not.toHaveProperty("description");
  });
});

describe("reserveOrder", () => {
  const lines = [{ variantId: "00000000-0000-4000-8000-000000000001", quantity: 2 }];

  it("transmet tailles, quantités, port et langue à la fonction SQL", async () => {
    const admin = fakeAdmin({ rpc: () => ({ data: order, error: null }) });
    const r = await reserveOrder(admin as unknown as Admin, lines, "fr");
    expect(r).toEqual({ ok: true, order });
    expect(admin.calls[0]).toMatchObject({
      op: "rpc:shop_reserve_order",
      args: { p_items: [{ variant_id: lines[0].variantId, quantity: 2 }], p_locale: "fr", p_ttl_minutes: 32 },
    });
  });

  it("transmet le nom et le numéro à imprimer (null pour l'absent) et laisse intacte une ligne ordinaire", async () => {
    const printed = { ...order, items: [{ ...order.items[0], print: { name: "MARTIN", number: "10", extra: 500 } }] };
    const admin = fakeAdmin({ rpc: () => ({ data: printed, error: null }) });
    const v = lines[0].variantId;
    const r = await reserveOrder(
      admin as unknown as Admin,
      [{ variantId: v, quantity: 1, print: { name: "MARTIN", number: "10" } }],
      "fr",
    );
    expect(r.ok).toBe(true);
    expect((admin.calls[0].args as { p_items: unknown[] }).p_items).toEqual([
      { variant_id: v, quantity: 1, print_name: "MARTIN", print_number: "10" },
    ]);
    const onlyNumber = fakeAdmin({ rpc: () => ({ data: { ...order, items: [{ ...order.items[0], print: { number: "7", extra: 0 } }] }, error: null }) });
    await reserveOrder(onlyNumber as unknown as Admin, [{ variantId: v, quantity: 1, print: { number: "7" } }], "fr");
    expect((onlyNumber.calls[0].args as { p_items: unknown[] }).p_items).toEqual([
      { variant_id: v, quantity: 1, print_name: null, print_number: "7" },
    ]);
  });

  it("garde-fou : une personnalisation absente de la commande réservée la fait annuler (base sans migration)", async () => {
    // L'ancienne fonction SQL ignore print_name / print_number : elle renverrait un article ordinaire.
    const admin = fakeAdmin({ rpc: (name) => (name === "shop_reserve_order" ? { data: order, error: null } : { data: true, error: null }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await reserveOrder(
      admin as unknown as Admin,
      [{ variantId: lines[0].variantId, quantity: 1, print: { name: "MARTIN" } }],
      "fr",
    );
    expect(r).toEqual({ ok: false, reason: "personalization" });
    expect(admin.calls.map((c) => c.op)).toEqual(["rpc:shop_reserve_order", "rpc:shop_release_order"]);
    expect(admin.calls[1].args).toEqual({ p_order: ORDER_ID });
  });

  it("refus de la base (produit qui ne propose pas la personnalisation, texte invalide)", async () => {
    const admin = fakeAdmin({ rpc: () => ({ data: null, error: { message: "shop:personalization" } }) });
    expect(
      await reserveOrder(admin as unknown as Admin, [{ variantId: lines[0].variantId, quantity: 1, print: { name: "A" } }], "fr"),
    ).toEqual({ ok: false, reason: "personalization" });
  });

  it("stock insuffisant : liste des tailles concernées", async () => {
    const admin = fakeAdmin({ rpc: () => ({ data: null, error: { message: "shop:stock", details: '["v1","v2"]' } }) });
    expect(await reserveOrder(admin as unknown as Admin, lines, "fr")).toEqual({ ok: false, reason: "stock", unavailable: ["v1", "v2"] });
  });

  it("autres refus : panier invalide ou erreur", async () => {
    const bad = fakeAdmin({ rpc: () => ({ data: null, error: { message: "shop:quantity" } }) });
    expect(await reserveOrder(bad as unknown as Admin, lines, "fr")).toEqual({ ok: false, reason: "invalid" });
    const down = fakeAdmin({ rpc: () => ({ data: null, error: { message: "connection refused" } }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reserveOrder(down as unknown as Admin, lines, "fr")).toEqual({ ok: false, reason: "error" });
  });
});

describe("abandonOrder", () => {
  const pending = (session: string | null) => fakeAdmin({
    select: () => ({ data: { id: ORDER_ID, status: "pending", stripe_session_id: session } }),
    rpc: (name) => (name === "shop_release_order" ? { data: true, error: null } : { data: "paid", error: null }),
  });

  it("ferme la page de paiement PUIS rend le stock", async () => {
    const admin = pending("cs_1");
    stripeMock.checkout.sessions.expire.mockResolvedValue({});
    expect(await abandonOrder(admin as unknown as Admin, ORDER_ID)).toBe(true);
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith("cs_1");
    expect(admin.calls.some((c) => c.op === "rpc:shop_release_order")).toBe(true);
  });

  it("déjà payée chez Stripe : enregistre le paiement, ne rend RIEN", async () => {
    const admin = pending("cs_1");
    stripeMock.checkout.sessions.expire.mockRejectedValue(new Error("session already complete"));
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_1", status: "complete", payment_status: "paid", metadata: { order_id: ORDER_ID }, amount_total: 11987, payment_intent: "pi_1" });
    expect(await abandonOrder(admin as unknown as Admin, ORDER_ID)).toBe(false);
    expect(admin.calls.some((c) => c.op === "rpc:shop_mark_paid")).toBe(true);
    expect(admin.calls.some((c) => c.op === "rpc:shop_release_order")).toBe(false);
  });

  it("Stripe injoignable : on ne rend rien (le filet repassera)", async () => {
    const admin = pending("cs_1");
    stripeMock.checkout.sessions.expire.mockRejectedValue(new Error("network"));
    stripeMock.checkout.sessions.retrieve.mockRejectedValue(new Error("network"));
    expect(await abandonOrder(admin as unknown as Admin, ORDER_ID)).toBe(false);
    expect(admin.calls.some((c) => c.op === "rpc:shop_release_order")).toBe(false);
  });

  it("déjà expirée : on rend", async () => {
    const admin = pending("cs_1");
    stripeMock.checkout.sessions.expire.mockRejectedValue(new Error("already expired"));
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_1", status: "expired", payment_status: "unpaid" });
    expect(await abandonOrder(admin as unknown as Admin, ORDER_ID)).toBe(true);
  });

  it("pas de page Stripe (création échouée) : on rend sans appeler Stripe", async () => {
    const admin = pending(null);
    expect(await abandonOrder(admin as unknown as Admin, ORDER_ID)).toBe(true);
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it("commande plus en attente : rien", async () => {
    const admin = fakeAdmin({ select: () => ({ data: { id: ORDER_ID, status: "paid", stripe_session_id: "cs_1" } }) });
    expect(await abandonOrder(admin as unknown as Admin, ORDER_ID)).toBe(false);
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
  });
});

describe("recordPayment / releaseFromSession / recordRefund", () => {
  it("transmet montant, client et adresse ; ignore une session non payée", async () => {
    const admin = fakeAdmin({ rpc: () => ({ data: "paid", error: null }), select: () => ({ data: null }) });
    const session = {
      id: "cs_9",
      payment_status: "paid",
      metadata: { order_id: ORDER_ID },
      amount_total: 11987,
      payment_intent: "pi_9",
      customer_details: { email: "a@b.fr", name: "Carte" },
      collected_information: { shipping_details: { name: "Alice", address: { city: "Lyon", country: "FR" } } },
    };
    expect(await recordPayment(admin as unknown as Admin, session as never)).toBe("paid");
    expect(admin.calls[0]).toMatchObject({
      op: "rpc:shop_mark_paid",
      args: { p_order: ORDER_ID, p_session: "cs_9", p_payment_intent: "pi_9", p_amount: 119.87, p_email: "a@b.fr", p_name: "Alice", p_address: { city: "Lyon", country: "FR" } },
    });
    expect(await recordPayment(admin as unknown as Admin, { ...session, payment_status: "unpaid" } as never)).toBe("unpaid");
  });

  it("confirmation de commande : envoyée au premier enregistrement du paiement (et pour un paiement tardif), jamais à un rejeu du webhook", async () => {
    const session = { id: "cs_9", payment_status: "paid", metadata: { order_id: ORDER_ID }, amount_total: 11987, payment_intent: "pi_9", customer_details: { email: "a@b.fr" } };
    for (const [result, expected] of [["paid", 1], ["paid_late", 1], ["already", 0], ["missing", 0]] as const) {
      confirmation.send.mockClear();
      const admin = fakeAdmin({ rpc: () => ({ data: result, error: null }), select: () => ({ data: null }) });
      expect(await recordPayment(admin as unknown as Admin, session as never)).toBe(result);
      expect(confirmation.send, result).toHaveBeenCalledTimes(expected);
      if (expected) expect(confirmation.send).toHaveBeenCalledWith(admin, ORDER_ID);
    }
    // Session non payée : rien à confirmer.
    confirmation.send.mockClear();
    const admin = fakeAdmin({ rpc: () => ({ data: "paid", error: null }) });
    await recordPayment(admin as unknown as Admin, { ...session, payment_status: "unpaid" } as never);
    expect(confirmation.send).not.toHaveBeenCalled();
  });

  it("session expirée → stock rendu pour SA commande", async () => {
    const admin = fakeAdmin({ rpc: () => ({ data: true, error: null }) });
    expect(await releaseFromSession(admin as unknown as Admin, { metadata: { order_id: ORDER_ID } } as never)).toBe(true);
    expect(admin.calls[0]).toMatchObject({ op: "rpc:shop_release_order", args: { p_order: ORDER_ID } });
  });

  describe("recordRefund — l'état est relu chez Stripe", () => {
    const READ = "id, status, note, refunded_amount";
    const READ_OLD = "id, status, note";
    type Row = { id: string; status: string; note: string | null; refunded_amount?: number | string | null };
    const paidRow = (over: Partial<Row> = {}): Row => ({ id: ORDER_ID, status: "paid", note: null, refunded_amount: null, ...over });
    const refundAdmin = (o: {
      order?: Row | null;
      readError?: { code?: string; message: string } | ((cols: string) => { code?: string; message: string } | null);
      pending?: { id: string; status: string } | null;
      update?: { error: unknown; data?: unknown } | ((values: Record<string, unknown>) => { error: unknown; data?: unknown });
    }) =>
      fakeAdmin({
        select: (_t, cols) => {
          if (cols === READ || cols === READ_OLD) {
            const err = typeof o.readError === "function" ? o.readError(cols) : o.readError;
            return err ? { data: null, error: err } : { data: o.order ?? null };
          }
          return { data: o.pending ?? null };
        },
        update: o.update ?? { error: null, data: [{ id: ORDER_ID }] },
      });
    const event = (over: Record<string, unknown> = {}) => ({ id: "ch_9", payment_intent: "pi_9", metadata: {}, ...over }) as never;
    const updates = (a: ReturnType<typeof fakeAdmin>) => a.calls.filter((c) => c.op === "update");
    const freshCharge = (amount_refunded: number, refunded: boolean) =>
      stripeMock.charges.retrieve.mockResolvedValue({ id: "ch_9", amount_refunded, refunded });

    beforeEach(() => {
      stripeMock.charges.retrieve.mockReset();
      stripeMock.paymentIntents.retrieve.mockReset();
    });

    it("total : « refunded », montant et date ; le montant vient de la charge RELUE, pas de l'événement", async () => {
      freshCharge(11987, true);
      const admin = refundAdmin({ order: paidRow() });
      // L'événement livré est un ancien partiel ; Stripe dit aujourd'hui « remboursée en totalité ».
      await recordRefund(admin as unknown as Admin, event({ refunded: false, amount_refunded: 490 }));
      expect(stripeMock.charges.retrieve).toHaveBeenCalledWith("ch_9");
      const [w] = updates(admin);
      expect(w.args).toMatchObject({ status: "refunded", refunded_amount: 119.87 });
      expect(typeof (w.args as { refunded_at: string }).refunded_at).toBe("string");
      expect((w.args as { note: string }).note.replace(/\s/g, " ")).toBe("Remboursée en totalité : 119,87 € (voir Stripe).");
      expect(w.filters).toContainEqual(["eq", ["id", ORDER_ID]]);
    });

    it("partiel : note, montant ET date (colonne « Date de remboursement » de l'export), statut inchangé", async () => {
      freshCharge(490, false);
      const admin = refundAdmin({ order: paidRow() });
      await recordRefund(admin as unknown as Admin, event());
      const [w] = updates(admin);
      expect(Object.keys(w.args as object).sort()).toEqual(["note", "refunded_amount", "refunded_at"]);
      expect((w.args as { refunded_amount: number }).refunded_amount).toBe(4.9);
      expect((w.args as { note: string }).note.replace(/\s/g, " ")).toBe("Remboursement partiel : 4,90 € (voir Stripe).");
    });

    it("événement rejoué ou déjà traité (même montant, même état) : rien n'est réécrit, pas même la date", async () => {
      freshCharge(490, false);
      const partial = refundAdmin({ order: paidRow({ refunded_amount: "4.90", note: "Remboursement partiel : 4,90 € (voir Stripe)." }) });
      await recordRefund(partial as unknown as Admin, event());
      expect(updates(partial)).toHaveLength(0);
      freshCharge(11987, true);
      const total = refundAdmin({ order: paidRow({ status: "refunded", refunded_amount: 119.87 }) });
      await recordRefund(total as unknown as Admin, event());
      expect(updates(total)).toHaveLength(0);
    });

    it("remboursement échoué ou annulé (le montant redescend) : l'état courant est écrit, la mention disparaît", async () => {
      freshCharge(0, false);
      const admin = refundAdmin({ order: paidRow({ refunded_amount: 4.9, note: "Remboursement partiel : 4,90 € (voir Stripe)." }) });
      await recordRefund(admin as unknown as Admin, event());
      expect(updates(admin)[0].args).toEqual({ refunded_amount: 0, refunded_at: null, note: null });
    });

    it("une alerte déjà posée (paiement tardif) est gardée ; une mention de remboursement précédente est remplacée", async () => {
      const late = "Paiement reçu après la fin de la réservation : stock à vérifier avant expédition.";
      const noteAfter = async (note: string | null, amount: number, fully: boolean) => {
        freshCharge(amount, fully);
        const admin = refundAdmin({ order: paidRow({ note }) });
        await recordRefund(admin as unknown as Admin, event());
        return (updates(admin)[0].args as { note: string }).note.replace(/\s/g, " ");
      };
      expect(await noteAfter(late, 490, false)).toBe(`${late} Remboursement partiel : 4,90 € (voir Stripe).`);
      expect(await noteAfter(`${late} Remboursement partiel : 4,90 € (voir Stripe).`, 11987, true)).toBe(
        `${late} Remboursée en totalité : 119,87 € (voir Stripe).`,
      );
      expect(await noteAfter("Remboursement partiel : 4,90 € (voir Stripe).", 11987, true)).toBe("Remboursée en totalité : 119,87 € (voir Stripe).");
    });

    it("lecture de la commande en erreur : levée (Stripe rejoue), aucune note réécrite à l'aveugle", async () => {
      const admin = refundAdmin({ readError: { code: "XX000", message: "boom" } });
      await expect(recordRefund(admin as unknown as Admin, event())).rejects.toThrow("boom");
      expect(updates(admin)).toHaveLength(0);
      expect(stripeMock.charges.retrieve).not.toHaveBeenCalled();
    });

    it("migration d'export pas passée (colonne absente, 42703 en lecture ou PGRST204 en écriture) : enregistré SANS le montant", async () => {
      freshCharge(11987, true);
      const oldSchema = refundAdmin({
        order: paidRow(),
        readError: (cols) => (cols === READ ? { code: "42703", message: "column refunded_amount does not exist" } : null),
      });
      await recordRefund(oldSchema as unknown as Admin, event());
      expect(updates(oldSchema)).toHaveLength(1);
      expect(updates(oldSchema)[0].args).toMatchObject({ status: "refunded" });
      expect(updates(oldSchema)[0].args).not.toHaveProperty("refunded_amount");

      const cacheLag = refundAdmin({
        order: paidRow(),
        update: (values) =>
          "refunded_amount" in values
            ? { error: { code: "PGRST204", message: "Could not find the 'refunded_amount' column of 'orders' in the schema cache" } }
            : { error: null, data: [{ id: ORDER_ID }] },
      });
      await recordRefund(cacheLag as unknown as Admin, event());
      expect(updates(cacheLag)).toHaveLength(2);
      expect(updates(cacheLag)[1].args).not.toHaveProperty("refunded_amount");
    });

    it("remboursement reçu AVANT l'enregistrement du paiement : erreur, pour que Stripe rejoue l'événement", async () => {
      const admin = refundAdmin({ order: null, pending: { id: ORDER_ID, status: "pending" } });
      await expect(recordRefund(admin as unknown as Admin, event({ metadata: { order_id: ORDER_ID } }))).rejects.toThrow(
        /avant l'enregistrement du paiement \(commande XBZ-0B6F1D3E\)/,
      );
      expect(updates(admin)).toHaveLength(0);
    });

    it("l'identifiant de commande manque sur la charge : lu sur le paiement lui-même", async () => {
      stripeMock.paymentIntents.retrieve.mockResolvedValue({ metadata: { order_id: ORDER_ID } });
      const admin = refundAdmin({ order: null, pending: { id: ORDER_ID, status: "pending" } });
      await expect(recordRefund(admin as unknown as Admin, event())).rejects.toThrow(/avant l'enregistrement du paiement/);
      expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith("pi_9");
    });

    it("paiement étranger à la boutique, ou commande abandonnée : ignoré sans erreur (rien à réessayer)", async () => {
      stripeMock.paymentIntents.retrieve.mockResolvedValue({ metadata: {} });
      const foreign = refundAdmin({ order: null });
      await expect(recordRefund(foreign as unknown as Admin, event({ payment_intent: "pi_x" }))).resolves.toBeUndefined();
      const cancelled = refundAdmin({ order: null, pending: { id: ORDER_ID, status: "cancelled" } });
      await expect(recordRefund(cancelled as unknown as Admin, event({ metadata: { order_id: ORDER_ID } }))).resolves.toBeUndefined();
      expect(updates(foreign).length + updates(cancelled).length).toBe(0);
    });

    it("erreur d'écriture : remontée (le webhook répond 500, Stripe réessaie)", async () => {
      freshCharge(100, true);
      const admin = refundAdmin({ order: paidRow(), update: { error: { code: "XX000", message: "boom" } } });
      await expect(recordRefund(admin as unknown as Admin, event())).rejects.toThrow("boom");
    });
  });
});

describe("sweepStaleReservations", () => {
  it("ne vise que les commandes en attente dont la réservation est dépassée", async () => {
    const admin = fakeAdmin({ select: () => ({ data: [] }) });
    await sweepStaleReservations(admin as unknown as Admin);
    const call = admin.calls[0];
    expect(call.filters).toContainEqual(["eq", ["status", "pending"]]);
    expect(call.filters.some(([f]) => f === "lt")).toBe(true);
  });
});
