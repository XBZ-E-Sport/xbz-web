// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({ sendMail: vi.fn(), configured: true }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
// Traductions : la clé en guise de texte (la mise en forme est testée dans order-mail.test.ts).
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}${JSON.stringify(values)}` : key,
}));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail, isMailConfigured: () => m.configured }));

import { CONFIRMATION_SINCE } from "@/lib/order-mail";
import { retryPendingConfirmations, sendOrderConfirmation, sendOrderConfirmationAfterResponse } from "@/lib/order-confirmation";

type Reply = { data: unknown; error: { code?: string; message: string } | null };

/** Faux client Supabase : réponses de lecture dans l'ordre, mises à jour et filtres notés. */
function fakeAdmin(opts: { reads?: Reply[]; list?: Reply; updateError?: { message: string } | null }) {
  const reads = [...(opts.reads ?? [])];
  const calls = { selects: [] as string[], updates: [] as Record<string, unknown>[], filters: [] as [string, unknown[]][] };
  const chain = (result: () => unknown) => {
    const c: Record<string, unknown> = {};
    for (const f of ["eq", "in", "is", "not", "gte", "lte", "order", "limit"]) {
      c[f] = (...a: unknown[]) => {
        calls.filters.push([f, a]);
        return c;
      };
    }
    c.maybeSingle = () => Promise.resolve(result());
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return c;
  };
  const admin = {
    from: () => ({
      select: (cols: string) => {
        calls.selects.push(cols);
        return chain(() => (opts.list && !reads.length ? opts.list : (reads.shift() ?? { data: null, error: null })));
      },
      update: (values: Record<string, unknown>) => {
        calls.updates.push(values);
        return chain(() => ({ error: opts.updateError ?? null }));
      },
    }),
  };
  return { admin: admin as never, calls };
}

const ID = "0b6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";
const order = (over: Record<string, unknown> = {}) => ({
  id: ID,
  status: "paid",
  items: [{ name: "Maillot", size: "M", quantity: 1, unit_amount: 4999 }],
  subtotal: "49.99",
  shipping: "4.90",
  amount_total: "54.89",
  locale: "fr",
  customer_email: "client@example.fr",
  customer_name: "Jeanne Martin",
  confirmation_sent_at: null,
  ...over,
});
const ok = (row: unknown): Reply => ({ data: row, error: null });

beforeEach(() => {
  m.sendMail.mockReset();
  m.configured = true;
  m.sendMail.mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sendOrderConfirmation", () => {
  it("commande payée : envoie au client, réponses vers le support, et note la date", async () => {
    const { admin, calls } = fakeAdmin({ reads: [ok(order())] });
    expect(await sendOrderConfirmation(admin, ID)).toEqual({ sent: true });
    expect(m.sendMail).toHaveBeenCalledTimes(1);
    expect(m.sendMail.mock.calls[0][0]).toMatchObject({ to: "client@example.fr", replyTo: "support@xbz-esport.com", subject: expect.stringContaining("subject") });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0]).toMatchObject({ confirmation_error: null });
    expect(typeof calls.updates[0].confirmation_sent_at).toBe("string");
  });

  it("déjà envoyée : rien n'est renvoyé (webhook rejoué, cron)", async () => {
    const { admin, calls } = fakeAdmin({ reads: [ok(order({ confirmation_sent_at: "2026-10-05T12:00:00Z" }))] });
    expect(await sendOrderConfirmation(admin, ID)).toEqual({ sent: true });
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(calls.updates).toHaveLength(0);
  });

  it("`force` (bouton du back-office) : renvoie même si elle est déjà partie", async () => {
    const { admin } = fakeAdmin({ reads: [ok(order({ confirmation_sent_at: "2026-10-05T12:00:00Z" }))] });
    expect(await sendOrderConfirmation(admin, ID, { force: true })).toEqual({ sent: true });
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["commande inconnue", ok(null), /introuvable/],
    ["commande en attente de paiement", ok(order({ status: "pending" })), /non payée/],
    ["commande annulée", ok(order({ status: "cancelled" })), /non payée/],
    ["commande remboursée", ok(order({ status: "refunded" })), /non payée/],
    ["pas d'adresse e-mail", ok(order({ customer_email: null })), /aucune adresse/],
    ["lecture en erreur", { data: null, error: { code: "XX000", message: "boom" } } as Reply, /lecture impossible/],
  ])("%s : rien n'est envoyé, le motif est rendu", async (_label, reply, message) => {
    const { admin, calls } = fakeAdmin({ reads: [reply] });
    const r = await sendOrderConfirmation(admin, ID);
    expect(r.sent).toBe(false);
    expect(r.error).toMatch(message);
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(calls.updates).toHaveLength(0);
  });

  it("échec du fournisseur : l'erreur est gardée (sans adresse), la date reste vide pour la reprise", async () => {
    m.sendMail.mockResolvedValue({ ok: false, error: "Brevo HTTP 503" });
    const { admin, calls } = fakeAdmin({ reads: [ok(order())] });
    expect(await sendOrderConfirmation(admin, ID)).toEqual({ sent: false, error: "Brevo HTTP 503" });
    expect(calls.updates).toEqual([{ confirmation_error: "Brevo HTTP 503" }]);
    expect(JSON.stringify(calls.updates)).not.toContain("client@example.fr");
  });

  it("migration pas passée (colonne absente) : l'e-mail part quand même, une fois, sans suivi", async () => {
    const { admin, calls } = fakeAdmin({
      reads: [{ data: null, error: { code: "42703", message: "column confirmation_sent_at does not exist" } }, ok(order())],
    });
    expect(await sendOrderConfirmation(admin, ID)).toEqual({ sent: true });
    expect(calls.selects).toHaveLength(2);
    expect(calls.selects[0]).toContain("confirmation_sent_at");
    expect(calls.selects[1]).not.toContain("confirmation_sent_at");
    expect(m.sendMail).toHaveBeenCalledTimes(1);
    expect(calls.updates).toHaveLength(0);
  });

  it("ne lève jamais, même si l'envoi lève", async () => {
    m.sendMail.mockRejectedValue(new Error("réseau"));
    const { admin } = fakeAdmin({ reads: [ok(order())] });
    expect(await sendOrderConfirmation(admin, ID)).toEqual({ sent: false, error: "erreur inattendue" });
  });

  it("langue de la commande : l'anglais est transmis au traducteur", async () => {
    const { admin } = fakeAdmin({ reads: [ok(order({ locale: "en" }))] });
    await sendOrderConfirmation(admin, ID);
    expect(m.sendMail.mock.calls[0][0].html).toContain('lang="en"');
  });

  it("montant : le total encaissé, ou à défaut sous-total + port", async () => {
    const { admin } = fakeAdmin({ reads: [ok(order({ amount_total: null, subtotal: "49.99", shipping: "4.90" }))] });
    await sendOrderConfirmation(admin, ID);
    expect(m.sendMail.mock.calls[0][0].text).toContain('totalLine{"amount":"54,89');
  });

  it("montant : amount_total prime sur sous-total + port", async () => {
    const { admin } = fakeAdmin({ reads: [ok(order({ amount_total: "60.00" }))] });
    await sendOrderConfirmation(admin, ID);
    expect(m.sendMail.mock.calls[0][0].text).toContain('totalLine{"amount":"60,00');
  });

  it("erreur inattendue : une trace est laissée (le filet et le back-office la voient), sans masquer l'erreur", async () => {
    m.sendMail.mockRejectedValue(new Error("boom"));
    const { admin, calls } = fakeAdmin({ reads: [ok(order())] });
    expect(await sendOrderConfirmation(admin, ID)).toEqual({ sent: false, error: "erreur inattendue" });
    expect(calls.updates).toEqual([{ confirmation_error: "erreur inattendue" }]);
  });
});

describe("sendOrderConfirmationAfterResponse", () => {
  it("panne passagère du fournisseur : un second essai quelques secondes plus tard", async () => {
    vi.useFakeTimers();
    m.sendMail.mockResolvedValueOnce({ ok: false, error: "Brevo HTTP 503" }).mockResolvedValueOnce({ ok: true });
    const { admin } = fakeAdmin({ reads: [ok(order()), ok(order())] });
    sendOrderConfirmationAfterResponse(admin, ID);
    await vi.advanceTimersByTimeAsync(0);
    expect(m.sendMail).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(m.sendMail).toHaveBeenCalledTimes(2);
  });

  it("échec définitif (clé refusée) : pas de second essai immédiat, le cron reprendra", async () => {
    vi.useFakeTimers();
    m.sendMail.mockResolvedValue({ ok: false, error: "Brevo HTTP 401" });
    const { admin } = fakeAdmin({ reads: [ok(order())] });
    sendOrderConfirmationAfterResponse(admin, ID);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("retryPendingConfirmations — filet quotidien", () => {
  it("vise les commandes payées non confirmées, dans la fenêtre de reprise et depuis la mise en service", async () => {
    const f = fakeAdmin({ reads: [], list: ok([]) });
    expect(await retryPendingConfirmations(f.admin, 10)).toBe(0);
    expect(f.calls.filters).toContainEqual(["in", ["status", ["paid", "fulfilled"]]]);
    expect(f.calls.filters).toContainEqual(["is", ["confirmation_sent_at", null]]);
    expect(f.calls.filters).toContainEqual(["limit", [10]]);
    const gte = f.calls.filters.find(([n]) => n === "gte")![1][1] as string;
    const lte = f.calls.filters.find(([n]) => n === "lte")![1][1] as string;
    // Jamais avant la mise en service ; au plus 3 jours en arrière.
    expect(Date.parse(gte)).toBeGreaterThanOrEqual(Date.parse(CONFIRMATION_SINCE));
    expect(Date.now() - Date.parse(gte)).toBeLessThanOrEqual(72 * 3600_000 + 1000);
    // Payée depuis au moins 15 min : l'envoi immédiat a eu sa chance.
    expect(Date.now() - Date.parse(lte)).toBeGreaterThan(14 * 60_000);
    expect(Date.now() - Date.parse(lte)).toBeLessThan(16 * 60_000);
  });

  /** Liste de commandes à reprendre ; chaque envoi relit sa commande. */
  function listAdmin(list: { id: string; confirmation_error: string | null }[]) {
    const reads: Reply[] = list.map((o) => ok(order({ id: o.id })));
    let n = 0;
    const admin = {
      from: () => ({
        select: (cols: string) => {
          const isList = cols.startsWith("id, confirmation_error");
          const c: Record<string, unknown> = {};
          for (const f of ["in", "is", "not", "gte", "lte", "order", "limit", "eq"]) c[f] = () => c;
          c.maybeSingle = () => Promise.resolve(reads[n++] ?? ok(null));
          c.then = (res: (v: unknown) => unknown) => Promise.resolve(isList ? ok(list) : ok(null)).then(res);
          return c;
        },
        update: () => ({ eq: () => ({ is: () => Promise.resolve({ error: null }), then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r) }) }),
      }),
    };
    return admin as never;
  }
  const A = ID;
  const B = "1c6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";
  const C = "2c6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";

  it("reprend un envoi interrompu sans trace et une panne passagère ; renvoie le nombre parti", async () => {
    expect(await retryPendingConfirmations(listAdmin([{ id: A, confirmation_error: null }, { id: B, confirmation_error: "Brevo HTTP 503" }]), 10)).toBe(2);
    expect(m.sendMail).toHaveBeenCalledTimes(2);
  });

  it("ne rejoue pas une erreur définitive (adresse refusée, clé invalide)", async () => {
    expect(await retryPendingConfirmations(listAdmin([{ id: C, confirmation_error: "Brevo HTTP 400 invalid_parameter" }]), 10)).toBe(0);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("envoi non configuré : rien n'est tenté", async () => {
    m.configured = false;
    const f = fakeAdmin({ reads: [], list: ok([]) });
    expect(await retryPendingConfirmations(f.admin)).toBe(0);
    expect(f.calls.selects).toHaveLength(0);
  });

  it("migration pas passée : 0, sans bruit dans les journaux", async () => {
    const f = fakeAdmin({ reads: [], list: { data: null, error: { code: "42703", message: "column confirmation_error does not exist" } } });
    expect(await retryPendingConfirmations(f.admin)).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("autre erreur de lecture : 0, et l'erreur est journalisée", async () => {
    const f = fakeAdmin({ reads: [], list: { data: null, error: { code: "XX000", message: "boom" } } });
    expect(await retryPendingConfirmations(f.admin)).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });
});
