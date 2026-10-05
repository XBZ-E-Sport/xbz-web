// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];

const m = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  readError: null as { code?: string; message: string } | null,
  // Compteurs d'accusés partis ces dernières 24 h
  sent: { mailbox: 0, total: 0, unmatched: 0 } as Record<string, number>,
  claim: [{ id: "w-1" }] as { id: string }[],
  claimError: null as { code?: string; message: string } | null,
  pending: [[], []] as { id: string }[][], // [liées à une commande, non rapprochées]
  pendingError: null as { message: string } | null,
  updates: [] as { patch: Record<string, unknown>; calls: Call[] }[],
  claims: [] as Call[][],
  pendingCalls: [] as Call[][],
  countCalls: [] as Call[][],
  tableError: null as { message: string } | null,
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

import { siteConfig } from "@/lib/site";
import {
  MAX_ACK_ATTEMPTS,
  MAX_ACK_PER_DAY,
  MAX_ACK_PER_MAILBOX_PER_DAY,
  MAX_UNMATCHED_ACK_PER_DAY,
  SUSPECT_ERROR,
  finishWithdrawalAfterResponse,
  notifyWithdrawal,
  retryPendingAcks,
  sendAck,
  withdrawalTableReady,
} from "@/lib/withdrawal-server";

const ORDER = "1a2b3c4d-0000-4000-8000-000000000001";

/** Constructeur chaînable : enregistre chaque appel, se résout avec ce que `resolve` décide. */
function chain(resolve: (calls: Call[]) => unknown, single?: (calls: Call[]) => unknown) {
  const calls: Call[] = [];
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === "then") {
          return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resolve(calls)).then(ok, ko);
        }
        if (prop === "maybeSingle" || prop === "single") return async () => (single ?? resolve)(calls);
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

const has = (calls: Call[], name: string, ...args: unknown[]) =>
  calls.some(([n, a]) => n === name && args.every((x, i) => JSON.stringify(a[i]) === JSON.stringify(x)));

const admin = {
  from: () => ({
    select: (_cols: string, opts?: { head?: boolean }) =>
      opts?.head
        ? chain((calls) => {
            m.countCalls.push(calls);
            const kind = has(calls, "eq", "mailbox_key") ? "mailbox" : has(calls, "in", "match") ? "unmatched" : "total";
            return { count: m.sent[kind], error: null };
          })
        : chain(
            (calls) => {
              if (has(calls, "limit", 1) && calls.length === 1) return { data: [], error: m.tableError }; // sonde de la table
              m.pendingCalls.push(calls);
              const linked = has(calls, "neq", "match", "none");
              return { data: m.pending[linked ? 0 : 1], error: m.pendingError };
            },
            () => ({ data: m.row, error: m.readError }),
          ),
    update: (patch: Record<string, unknown>) =>
      chain((calls) => {
        if (calls.some(([n]) => n === "select")) {
          m.claims.push(calls);
          return { data: m.claim, error: m.claimError };
        }
        m.updates.push({ patch, calls });
        return { error: null };
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
  mailbox_key: "jeanne@exemple.fr",
  suspect: false,
  received_at: "2026-10-04T23:11:23.000Z",
  ack_sent_at: null,
  ack_attempts: 0,
  ack_error: null,
  ...over,
});

beforeEach(() => {
  m.row = row();
  m.readError = null;
  m.sent = { mailbox: 0, total: 0, unmatched: 0 };
  m.claim = [{ id: "w-1" }];
  m.claimError = null;
  m.pending = [[], []];
  m.pendingError = null;
  m.tableError = null;
  m.configured = true;
  m.updates = [];
  m.claims = [];
  m.pendingCalls = [];
  m.countCalls = [];
  for (const f of [m.sendMail, m.fetch]) f.mockReset();
  m.sendMail.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", m.fetch);
  m.fetch.mockResolvedValue(new Response(null, { status: 204 }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const lastUpdate = () => m.updates.at(-1)?.patch;

describe("sendAck — envoi nominal", () => {
  it("envoie l'accusé (réponse à l'adresse de contact) et note l'envoi, verrou levé", async () => {
    expect(await sendAck(admin, "w-1")).toEqual({ sent: true });
    const mail = m.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("jeanne@exemple.fr");
    expect(mail.replyTo).toBe("support@xbz-esport.com");
    expect(mail.subject).toBe("Accusé de réception de ta rétractation — XBZ Esport");
    // Commande rapprochée : son numéro ; date ET heure de la déclaration.
    expect(mail.text).toContain("XBZ-1A2B3C4D");
    expect(mail.text).toContain("01:11:23");
    expect(mail.text).toContain(`${siteConfig.url}/fr/cgv#retractation`);
    expect(lastUpdate()).toEqual({
      ack_sent_at: expect.any(String),
      ack_attempts: 1,
      ack_error: null,
      ack_hold_until: null,
    });
  });

  it("le texte tapé par le client PRIME sur le numéro de la commande rapprochée (c'est le contenu de sa déclaration)", async () => {
    m.row = row({ order_number: "ma commande de mai" });
    await sendAck(admin, "w-1");
    const text: string = m.sendMail.mock.calls[0][0].text;
    expect(text).toContain("Commande : ma commande de mai");
    expect(text).not.toContain("XBZ-1A2B3C4D");
  });

  it("écrit dans la langue de la déclaration", async () => {
    m.row = row({ locale: "en" });
    await sendAck(admin, "w-1");
    const mail = m.sendMail.mock.calls[0][0];
    expect(mail.subject).toMatch(/^Acknowledgement of receipt/);
    expect(mail.text).toContain(`${siteConfig.url}/en/cgv#retractation`);
  });

  it("échec du fournisseur : l'erreur et le nombre d'essais sont notés pour le filet, verrou levé", async () => {
    m.sendMail.mockResolvedValue({ ok: false, error: "Brevo HTTP 503" });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "Brevo HTTP 503" });
    expect(lastUpdate()).toEqual({ ack_attempts: 1, ack_error: "Brevo HTTP 503", ack_hold_until: null });
  });

  it("déjà envoyé : ne renvoie rien (pas de double accusé)", async () => {
    m.row = row({ ack_sent_at: "2026-10-04T23:11:30.000Z", ack_attempts: 1 });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: true });
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(m.claims).toHaveLength(0);
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

describe("sendAck — verrou (route et cron sur la même ligne)", () => {
  it("le verrou est posé AVANT l'appel au fournisseur, seulement si rien n'est parti ni en cours", async () => {
    await sendAck(admin, "w-1");
    const claim = m.claims[0];
    expect(has(claim, "eq", "id", "w-1")).toBe(true);
    expect(has(claim, "is", "ack_sent_at", null)).toBe(true);
    expect(claim.find(([n]) => n === "or")?.[1][0]).toMatch(/^ack_hold_until\.is\.null,ack_hold_until\.lt\./);
    expect(m.claims[0]).toBeDefined();
  });

  it("un envoi déjà en cours (verrou perdu) : n'envoie PAS une seconde fois", async () => {
    m.claim = [];
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "envoi déjà en cours" });
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("verrou impossible (base en erreur) : on n'envoie pas à l'aveugle", async () => {
    m.claimError = { code: "42703", message: "column does not exist" };
    expect((await sendAck(admin, "w-1")).error).toMatch(/verrou impossible \(42703\)/);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("le staff (force) passe outre un verrou resté posé, mais pas outre un accusé déjà parti", async () => {
    await sendAck(admin, "w-1", { force: true });
    expect(m.claims[0].some(([n]) => n === "or")).toBe(false);
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("sendAck — suspect, essais épuisés, plafonds", () => {
  it("piège anti-bot rempli : jamais d'envoi automatique, motif explicite ; le staff peut forcer", async () => {
    m.row = row({ suspect: true });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: SUSPECT_ERROR });
    expect(m.sendMail).not.toHaveBeenCalled();

    expect(await sendAck(admin, "w-1", { force: true })).toEqual({ sent: true });
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });

  it("essais épuisés : suspendu tant que le staff ne force pas", async () => {
    m.row = row({ ack_attempts: MAX_ACK_ATTEMPTS, ack_error: "Brevo HTTP 401" });
    expect(await sendAck(admin, "w-1")).toEqual({ sent: false, error: "Brevo HTTP 401" });
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(await sendAck(admin, "w-1", { force: true })).toEqual({ sent: true });
  });

  it("plafond par BOÎTE aux lettres : l'envoi est DIFFÉRÉ (aucun essai brûlé), motif noté ; sous le plafond, il part", async () => {
    m.sent.mailbox = MAX_ACK_PER_MAILBOX_PER_DAY;
    const result = await sendAck(admin, "w-1");
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/plafond de 3 accusés par boîte aux lettres/);
    expect(m.sendMail).not.toHaveBeenCalled();
    // Ni essai brûlé ni verrou : la ligne reste dans la file du cron.
    expect(lastUpdate()).toEqual({ ack_error: result.error });
    expect(m.claims).toHaveLength(0);
    // La clé de boîte est celle de la ligne (adresses « +tag » et points de Gmail comptés ensemble).
    expect(m.countCalls.some((c) => has(c, "eq", "mailbox_key", "jeanne@exemple.fr"))).toBe(true);

    m.sent.mailbox = MAX_ACK_PER_MAILBOX_PER_DAY - 1;
    expect(await sendAck(admin, "w-1")).toEqual({ sent: true });
  });

  it("plafond GLOBAL de 100 accusés par jour : différé, pour ne pas épuiser le quota gratuit de Brevo", async () => {
    m.sent.total = MAX_ACK_PER_DAY;
    expect((await sendAck(admin, "w-1")).error).toMatch(/plafond de 100 accusés par jour/);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("déclarations NON rapprochées : plafond propre de 40 par jour, les rapprochées gardent leur place", async () => {
    m.sent.unmatched = MAX_UNMATCHED_ACK_PER_DAY;
    m.row = row({ match: "none", order_id: null });
    expect((await sendAck(admin, "w-1")).error).toMatch(/non rapprochées/);
    m.row = row({ match: "mismatch", order_id: null });
    expect((await sendAck(admin, "w-1")).sent).toBe(false);
    expect(m.sendMail).not.toHaveBeenCalled();

    m.row = row({ match: "exact" }); // rapprochée : même compteur plein, elle part
    expect(await sendAck(admin, "w-1")).toEqual({ sent: true });
  });

  it("le staff (force) ignore tous les plafonds", async () => {
    m.sent = { mailbox: 99, total: 999, unmatched: 99 };
    m.row = row({ match: "none", order_id: null });
    expect(await sendAck(admin, "w-1", { force: true })).toEqual({ sent: true });
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
    m.row = row({ match: "exact" });
    await notifyWithdrawal(admin, "w-1", { sent: true });
    const sent = JSON.parse(String(m.fetch.mock.calls[0][1].body));
    const text = JSON.stringify(sent);
    expect(text).toContain("XBZ-1A2B3C4D");
    expect(text).toContain("Accusé de réception envoyé");
    expect(text).not.toContain("Jeanne");
    expect(text).not.toContain("jeanne@exemple.fr");
    expect(sent.allowed_mentions).toEqual({ parse: [] });
    expect(sent.embeds[0].url).toBe(`${siteConfig.url}/fr/admin/commandes?vue=retractations`);
  });

  it("rapprochement déduit de l'e-mail seul (« single ») : le dit et demande de vérifier", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "https://discord.test/hook");
    await notifyWithdrawal(admin, "w-1", { sent: true });
    const text = JSON.stringify(JSON.parse(String(m.fetch.mock.calls[0][1].body)));
    expect(text).toContain("à confirmer");
    expect(text).toContain("à vérifier dans le back-office");
  });

  it("accusé NON envoyé et commande non reconnue : le dit, sans reprendre le texte libre du client", async () => {
    vi.stubEnv("DISCORD_COMMANDES_WEBHOOK_URL", "https://discord.test/hook");
    m.row = row({ order_id: null, order_number: "XBZ-00000000", match: "mismatch" });
    await notifyWithdrawal(admin, "w-1", { sent: false, error: "Brevo HTTP 503" });
    const text = JSON.stringify(JSON.parse(String(m.fetch.mock.calls[0][1].body)));
    expect(text).toContain("XBZ-00000000");
    expect(text).toContain("aucune commande payée de cet e-mail ne le porte");
    expect(text).toContain("NON envoyé");
    expect(text).toContain("Brevo HTTP 503");

    // Texte libre (potentiellement spam ou lien) : jamais recopié dans Discord.
    m.fetch.mockClear();
    m.row = row({ order_id: null, order_number: "visitez http://spam.test @everyone", match: "none" });
    await notifyWithdrawal(admin, "w-1", { sent: true });
    const free = String(m.fetch.mock.calls[0][1].body);
    expect(free).not.toContain("spam.test");
    expect(free).not.toContain("@everyone");
    expect(free).toContain("Commande non identifiée");
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
    // 401 = clé ou adresse IP refusée : pas une panne passagère, un seul essai.
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });

  it("panne PASSAGÈRE du fournisseur (429, 5xx, réseau) : un second essai quelques secondes plus tard", async () => {
    vi.useFakeTimers();
    m.sendMail.mockResolvedValueOnce({ ok: false, error: "Brevo HTTP 503" }).mockResolvedValueOnce({ ok: true });
    finishWithdrawalAfterResponse(admin, "w-1");
    await vi.advanceTimersByTimeAsync(3_100);
    await vi.waitFor(() => expect(m.sendMail).toHaveBeenCalledTimes(2));
  });
});

describe("withdrawalTableReady", () => {
  it("vrai quand la table se lit, faux quand la migration n'est pas passée", async () => {
    expect(await withdrawalTableReady(admin)).toBe(true);
    m.tableError = { message: "relation does not exist" };
    expect(await withdrawalTableReady(admin)).toBe(false);
  });
});

describe("retryPendingAcks — filet quotidien", () => {
  it("e-mail non configuré : n'essaie rien", async () => {
    m.configured = false;
    m.pending = [[{ id: "w-1" }], []];
    expect(await retryPendingAcks(admin)).toBe(0);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("ne reprend QUE ce qui peut partir : accusé non envoyé, pas suspect, essais restants, verrou libre", async () => {
    await retryPendingAcks(admin);
    for (const calls of m.pendingCalls) {
      expect(has(calls, "is", "ack_sent_at", null)).toBe(true);
      expect(has(calls, "eq", "suspect", false)).toBe(true);
      expect(has(calls, "lt", "ack_attempts", MAX_ACK_ATTEMPTS)).toBe(true);
      expect(calls.find(([n]) => n === "or")?.[1][0]).toMatch(/^ack_hold_until\.is\.null,ack_hold_until\.lt\./);
    }
  });

  it("les déclarations liées à une commande ou à un numéro passent AVANT le bruit non rapproché", async () => {
    m.pending = [[{ id: "w-vrai" }], [{ id: "w-bruit" }]];
    m.row = row();
    await retryPendingAcks(admin, 10);
    // Deux requêtes : d'abord « match ≠ none », puis « match = none ».
    expect(has(m.pendingCalls[0], "neq", "match", "none")).toBe(true);
    expect(has(m.pendingCalls[1], "eq", "match", "none")).toBe(true);
    expect(m.sendMail).toHaveBeenCalledTimes(2);
  });

  it("la limite est partagée : le bruit ne prend jamais la place restante d'une déclaration liée", async () => {
    m.pending = [[{ id: "a" }, { id: "b" }], [{ id: "c" }]];
    await retryPendingAcks(admin, 2);
    // Limite atteinte avec les déclarations liées : la requête « non rapprochées » n'a même pas lieu.
    expect(m.pendingCalls).toHaveLength(1);
    expect(m.sendMail).toHaveBeenCalledTimes(2);
  });

  it("compte les accusés partis ; un échec n'empêche pas les autres", async () => {
    m.pending = [[{ id: "w-1" }, { id: "w-2" }], []];
    m.sendMail.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Brevo HTTP 503" });
    expect(await retryPendingAcks(admin)).toBe(1);
  });

  it("lecture de la file en erreur : 0, sans exception", async () => {
    m.pendingError = { message: "boom" };
    expect(await retryPendingAcks(admin)).toBe(0);
  });
});
