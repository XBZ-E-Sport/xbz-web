// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const admin = vi.hoisted(() => ({
  listed: null as { email: string } | null,
  listError: null as { message: string } | null,
  deleteError: null as { message: string } | null,
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: admin.listed, error: admin.listError }) }),
      }),
    }),
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          admin.deleteUser(id);
          return { error: admin.deleteError };
        },
      },
    },
  }),
}));

import {
  checkDiscordStaff,
  deleteUnauthorizedAccount,
  denyMessage,
  hasFreshDiscordStaff,
  STAFF_TTL_DAYS,
  staffRoleIds,
} from "@/lib/discord-guard";

const GUILD = "111111111111111111";
const ROLE_ADMIN = "222222222222222222";
const ROLE_FONDATEUR = "333333333333333333";
const ROLE_MEMBRE = "999999999999999999";

function mockDiscord(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response as Response);
}

beforeEach(() => {
  vi.stubEnv("DISCORD_GUILD_ID", GUILD);
  vi.stubEnv("DISCORD_STAFF_ROLE_IDS", `${ROLE_ADMIN}, ${ROLE_FONDATEUR}`);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("staffRoleIds", () => {
  it("découpe la liste et ignore les espaces", () => {
    expect(staffRoleIds()).toEqual([ROLE_ADMIN, ROLE_FONDATEUR]);
  });

  it("renvoie une liste vide si la variable est absente", () => {
    vi.stubEnv("DISCORD_STAFF_ROLE_IDS", "");
    expect(staffRoleIds()).toEqual([]);
  });
});

describe("checkDiscordStaff", () => {
  it("accepte un membre portant le rôle Administrateur", async () => {
    mockDiscord({ ok: true, status: 200, json: async () => ({ roles: [ROLE_MEMBRE, ROLE_ADMIN] }) });

    const result = await checkDiscordStaff("token");
    expect(result).toEqual({ ok: true, roles: [ROLE_MEMBRE, ROLE_ADMIN] });
  });

  it("accepte aussi le rôle Fondateur", async () => {
    mockDiscord({ ok: true, status: 200, json: async () => ({ roles: [ROLE_FONDATEUR] }) });
    expect((await checkDiscordStaff("token")).ok).toBe(true);
  });

  it("refuse un membre du serveur SANS rôle autorisé", async () => {
    mockDiscord({ ok: true, status: 200, json: async () => ({ roles: [ROLE_MEMBRE] }) });
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "missing_role" });
  });

  it("refuse quelqu'un qui n'est pas sur le serveur (404)", async () => {
    mockDiscord({ ok: false, status: 404 });
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "not_member" });
  });

  it("refuse quand aucun rôle n'est renvoyé", async () => {
    mockDiscord({ ok: true, status: 200, json: async () => ({}) });
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "missing_role" });
  });

  it("refuse sans jeton OAuth", async () => {
    const fetchSpy = mockDiscord({ ok: true, status: 200, json: async () => ({}) });
    expect(await checkDiscordStaff(null)).toEqual({ ok: false, reason: "no_token" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuse (fail-safe) si la configuration manque", async () => {
    vi.stubEnv("DISCORD_GUILD_ID", "");
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "not_configured" });

    vi.stubEnv("DISCORD_GUILD_ID", GUILD);
    vi.stubEnv("DISCORD_STAFF_ROLE_IDS", "");
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "not_configured" });
  });

  it("refuse si Discord est injoignable ou renvoie une erreur", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "error" });

    mockDiscord({ ok: false, status: 500 });
    expect(await checkDiscordStaff("token")).toEqual({ ok: false, reason: "error" });
  });

  it("interroge le bon endpoint avec le jeton de l'utilisateur", async () => {
    const fetchSpy = mockDiscord({ ok: true, status: 200, json: async () => ({ roles: [ROLE_ADMIN] }) });
    await checkDiscordStaff("mon-jeton");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://discord.com/api/v10/users/@me/guilds/${GUILD}/member`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer mon-jeton");
  });
});

describe("denyMessage", () => {
  it("explique le refus sans détail technique", () => {
    expect(denyMessage("not_member")).toContain("membre du serveur Discord");
    expect(denyMessage("missing_role")).toContain("Administrateur ou Fondateur");
    expect(denyMessage("error")).not.toMatch(/token|API|fetch/i);
  });
});

describe("hasFreshDiscordStaff", () => {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const DAY = 24 * 3600 * 1000;

  it("la TTL est d'un jour (sursis maximal d'un rôle Discord retiré)", () => {
    // Le raccourcissement à 1 jour avait été commité dans une copie morte du
    // module (discordguard.ts) : la prod est restée à 7 jours sans que rien
    // ne le signale. Cette valeur est une décision de sécurité, pas un détail.
    expect(STAFF_TTL_DAYS).toBe(1);
  });

  it("accepte un verdict encore dans la fenêtre", () => {
    // Exprimé PAR RAPPORT à la TTL : une valeur en dur (« un jour ») changeait
    // de sens le jour où la TTL a été raccourcie de 7 jours à 1.
    const fresh = STAFF_TTL_DAYS * DAY - 60_000;
    expect(hasFreshDiscordStaff({ xbz_staff: true, xbz_staff_at: iso(fresh) })).toBe(true);
  });

  it("refuse un verdict périmé (au-delà de la TTL)", () => {
    const expired = STAFF_TTL_DAYS * DAY + 60_000;
    expect(hasFreshDiscordStaff({ xbz_staff: true, xbz_staff_at: iso(expired) })).toBe(false);
  });

  it("refuse un accès révoqué", () => {
    expect(hasFreshDiscordStaff({ xbz_staff: false, xbz_staff_at: iso(0) })).toBe(false);
  });

  it("refuse un compte sans verdict", () => {
    expect(hasFreshDiscordStaff({})).toBe(false);
    expect(hasFreshDiscordStaff(null)).toBe(false);
    expect(hasFreshDiscordStaff(undefined)).toBe(false);
  });

  it("refuse une date absente ou illisible (pas de faille par valeur bizarre)", () => {
    expect(hasFreshDiscordStaff({ xbz_staff: true })).toBe(false);
    expect(hasFreshDiscordStaff({ xbz_staff: true, xbz_staff_at: "bientôt" })).toBe(false);
    expect(hasFreshDiscordStaff({ xbz_staff: "true", xbz_staff_at: iso(0) })).toBe(false);
  });
});

describe("deleteUnauthorizedAccount", () => {
  const discordUser = { id: "u1", email: "inconnu@exemple.fr", identities: [{ provider: "discord" }] };

  beforeEach(() => {
    admin.listed = null;
    admin.listError = null;
    admin.deleteError = null;
    admin.deleteUser.mockReset();
  });

  it("supprime le compte Discord d'un inconnu (hors liste staff)", async () => {
    expect(await deleteUnauthorizedAccount(discordUser)).toBe(true);
    expect(admin.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("supprime aussi un compte Discord sans email", async () => {
    expect(await deleteUnauthorizedAccount({ ...discordUser, email: undefined })).toBe(true);
    expect(admin.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("garde un compte dont l'email est dans allow_staff_list", async () => {
    admin.listed = { email: discordUser.email };
    expect(await deleteUnauthorizedAccount(discordUser)).toBe(false);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it("garde un compte avec une identité email + mot de passe (staff possible)", async () => {
    const mixed = { ...discordUser, identities: [{ provider: "discord" }, { provider: "email" }] };
    expect(await deleteUnauthorizedAccount(mixed)).toBe(false);
    expect(await deleteUnauthorizedAccount({ ...discordUser, identities: [{ provider: "email" }] })).toBe(false);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it("dans le doute (identités inconnues, lecture de la liste en erreur) : on garde", async () => {
    expect(await deleteUnauthorizedAccount({ ...discordUser, identities: [] })).toBe(false);
    expect(await deleteUnauthorizedAccount({ ...discordUser, identities: undefined })).toBe(false);
    admin.listError = { message: "boom" };
    expect(await deleteUnauthorizedAccount(discordUser)).toBe(false);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it("échec de la suppression : renvoie false et journalise sans l'email", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    admin.deleteError = { message: "db down" };
    expect(await deleteUnauthorizedAccount(discordUser)).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0])).not.toContain(discordUser.email);
  });
});
