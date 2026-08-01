// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { checkDiscordStaff, denyMessage, staffRoleIds } from "@/lib/discord-guard";

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
