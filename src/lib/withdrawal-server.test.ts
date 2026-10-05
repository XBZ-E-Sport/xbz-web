// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  readError: null as { code?: string; message: string } | null,
  pending: [] as { id: string }[],
  pendingError: null as { message: string } | null,
  update: vi.fn(),
  selectEq: vi.fn(),
  sendMail: vi.fn(),
  configured: true,
  fetch: vi.fn(),
}));

vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail, isMailConfigured: () => m.configured }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock("next-intl/server", async () => {
  const fr = (await import("../../messages/fr.json")).default;
  const en = (await import("../../messages/en.json")).default;
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: { fr, en }[locale] as never, namespace: namespace as never }),
  };
});
vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));

import { retryPendingAcks, sendAck, notifyWithdrawal, finishWithdrawalAfterResponse, MAX_ACK_ATTEMPTS } from "@/lib/withdrawal-server";

const ORDER = "1a2b3c4d-0000-4000-8000-000000000001";

const admin = {
  from: () => ({
    // lecture d'UNE déclaration
    select: () => ({
      eq: (col: string, id: string) => {
        m.selectEq(col, id);
        return { maybeSingle: async () => ({ data: m.row, error: m.readError }) };
      },
      // lecture de la file des accusés en attente
      is: () => ({
        lt: () => ({ order: () => ({ limit: async () => ({ data: m.pending, error: m.pendingError }) }) }),
      }),
    }),
    update: (patch: unknown) => ({
      eq: async (col: string, id: string) => {
        m.update(patch, col, id);
        return { error: null };
      },
    }),
  }),
} as never;

const row = (over: Record<string, unknown> = {}) => ({
  id: "w-1",
  order_id: ORDER,
  order_number: null,
  match: "single",
  customer_name: "Jeanne Martin",
  customer_email: "jeanne@exemple.fr",
  details: null,
  locale: "fr",
  received_at: "2026-10-04T23:11:23.000Z",
  ack_sent_at: null,
  ack_attempts: 0,
  ack_error: null,
  ...over,
});

beforeEach(() => {
  m.row = row();
  m.readError = null;
  m.pending = [];
  m.pendingError = null;
  m.configured = true;
  for (const f of [m.update, m.selectEq, m.sendMail, m.fetch]) f.mockReset();
  m.sendMail.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", m.fetch);
  m.fetch.mockResolvedValue(new Response(null, { status: 204 }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendAck", () => {
  it("envoie l'accusé au client (réponse à l'adresse de contact) et note l'envoi", async () => {
    expect(await sendAck(admin, "w-1")).toEqual({ sent: true });
    const mail = m.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("jeanne@exemple.fr");
    expect(mail.replyTo).toBe("support@xbz-esport.com");
    expect(mail.subject).toBe("Accusé de réception de ta rétractation — XBZ Esport");
    // Numéro de commande déduit de la commande rapprochée ; date ET heure de la déclaration.
    expect(mail.text).toContain("XBZ-1A2B3C4D");
    expect(mail.text).toContain("01:11:23");
    expect(mail.text).toContain("https://www.xbz-esport.org/fr/cgv#retractation");
    expect(m.update).toHaveBeenCalledWith(
      { ack_sent_at: expect.any(String), ack_attempts: 1, ack_error: null },
      "id",
      "w-1",
    );
  });

  it("écrit dans la langue de la déclaration", async () => {
    m.row = row({ locale: "en" });
    await sendAck(admin, "w-1");
    const mail = m.sendMail.mock.calls[0][0];
    expect(mail.subject).toMatch(/^Acknowledgement of receipt/);
    expect(mail.text).toContain("/en/cgv#retractation");
  });

  it("échec du fournisseur : l'erreur et le nombre d'essais sont notés pour le filet", async () => {
    m.sendMail.mockResolvedValue({ ok: false, error: "Brevo HTTP 503" });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "Brevo HTTP 503" });
    expect(m.update).toHaveBeenCalledWith({ ack_attempts: 1, ack_error: "Brevo HTTP 503" }, "id", "w-1");
  });

  it("déjà envoyé : ne renvoie rien (pas de double accusé)", async () => {
    m.row = row({ ack_sent_at: "2026-10-04T23:11:30.000Z", ack_attempts: 1 });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: true });
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("essais épuisés ou plafond atteint : suspendu tant que le staff ne force pas", async () => {
    m.row = row({ ack_attempts: MAX_ACK_ATTEMPTS, ack_error: "plafond de 3 accusés atteint" });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "plafond de 3 accusés atteint" });
    expect(m.sendMail).not.toHaveBeenCalled();

    expect(await sendAck(admin, "w-1", { force: true })).toEqual({ sent: true });
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });

  it("déclaration introuvable ou lecture en erreur : échec propre, rien n'est envoyé", async () => {
    m.row = null;
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "déclaration introuvable" });
    m.readError = { code: "42P01", message: "relation does not exist" };
    expect((await sendAck(admin, "w-1")).error).toMatch(/lecture impossible \(42P01\)/);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("ne lève jamais, même si l'envoi plante de façon inattendue", async () => {
    m.sendMail.mockRejectedValue(new Error("explosion"));
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "erreur inattendue" });
  });
});

describe("notifyWithdrawal — alerte Discord sans donnée personnelle", () => {
  it("sans webhook configuré : ne fait rien", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "");
    await notifyWithdrawal(admin, "w-1", { sent: true });
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("commande rapprochée + accusé parti : numéro de commande, aucune donnée du client", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "https://discord.test/hook");
    await notifyWithdrawal(admin, "w-1", { sent: true });
    const sent = JSON.parse(String(m.fetch.mock.calls[0][1].body));
    const text = JSON.stringify(sent);
    expect(text).toContain("XBZ-1A2B3C4D");
    expect(text).toContain("Accusé de réception envoyé");
    expect(text).not.toContain("Jeanne");
    expect(text).not.toContain("jeanne@exemple.fr");
    expect(sent.allowed_mentions).toEqual({ parse: [] });
    expect(sent.embeds[0].url).toBe("https://www.xbz-esport.org/fr/admin/commandes?vue=retractations");
  });

  it("accusé NON envoyé ou commande non identifiée : le dit et demande une action", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "https://discord.test/hook");
    m.row = row({ order_id: null, order_number: "XBZ-00000000", match: "none" });
    await notifyWithdrawal(admin, "w-1", { sent: false, error: "Brevo HTTP 503" });
    const text = JSON.stringify(JSON.parse(String(m.fetch.mock.calls[0][1].body)));
    expect(text).toContain("XBZ-00000000");
    expect(text).toContain("non reconnue");
    expect(text).toContain("à rapprocher à la main");
    expect(text).toContain("NON envoyé");
    expect(text).toContain("Brevo HTTP 503");
  });

  it("Discord en panne : jamais d'exception", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "https://discord.test/hook");
    m.fetch.mockRejectedValue(new Error("réseau"));
    await expect(notifyWithdrawal(admin, "w-1", { sent: true })).resolves.toBeUndefined();
  });
});

describe("finishWithdrawalAfterResponse", () => {
  it("accusé d'abord, puis alerte du staff avec son résultat", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "https://discord.test/hook");
    m.sendMail.mockResolvedValue({ ok: false, error: "Brevo HTTP 401" });
    finishWithdrawalAfterResponse(admin, "w-1");
    await vi.waitFor(() => expect(m.fetch).toHaveBeenCalledTimes(1));
    expect(m.sendMail.mock.invocationCallOrder[0]).toBeLessThan(m.fetch.mock.invocationCallOrder[0]);
    expect(String(m.fetch.mock.calls[0][1].body)).toContain("Brevo HTTP 401");
  });
});

describe("retryPendingAcks — filet quotidien", () => {
  it("e-mail non configuré : n'essaie rien", async () => {
    m.configured = false;
    m.pending = [{ id: "w-1" }];
    expect(await retryPendingAcks(admin)).toBe(0);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("renvoie chaque accusé en attente et compte ceux qui partent", async () => {
    m.pending = [{ id: "w-1" }, { id: "w-2" }];
    m.sendMail.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Brevo HTTP 503" });
    expect(await retryPendingAcks(admin)).toBe(1);
    expect(m.selectEq).toHaveBeenCalledTimes(2);
  });

  it("lecture de la file en erreur : 0, sans exception", async () => {
    m.pendingError = { message: "boom" };
    expect(await retryPendingAcks(admin)).toBe(0);
  });
});
