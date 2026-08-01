// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { exchangeMock, signOutMock, checkMock } = vi.hoisted(() => ({
  exchangeMock: vi.fn(),
  signOutMock: vi.fn(),
  checkMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: (...a: unknown[]) => exchangeMock(...a),
      signOut: () => signOutMock(),
    },
  }),
}));

vi.mock("@/lib/discord-guard", () => ({
  checkDiscordStaff: (...a: unknown[]) => checkMock(...a),
  denyMessage: (reason: string) => `refus:${reason}`,
  DISCORD_SCOPES: "identify email guilds.members.read",
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: string) => new Response(null, { status: 307, headers: { location: url } }),
  },
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "https://xbz.test";
const session = (providerToken: string | null = "jeton") => ({
  data: {
    session: { provider_token: providerToken, user: { id: "u1", email: "staff@xbz.gg" } },
  },
  error: null,
});

const call = (query: string) => GET(new Request(`${ORIGIN}/auth/callback${query}`));
const location = (res: Response) => res.headers.get("location") ?? "";

beforeEach(() => {
  exchangeMock.mockReset().mockResolvedValue(session());
  signOutMock.mockReset();
  checkMock.mockReset().mockResolvedValue({ ok: true, roles: ["1"] });
});

describe("GET /auth/callback", () => {
  it("laisse entrer un membre au rôle autorisé", async () => {
    const res = await call("?code=abc&next=/admin");
    expect(location(res)).toBe(`${ORIGIN}/admin`);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("REFUSE et déconnecte si la personne n'est pas sur le serveur", async () => {
    checkMock.mockResolvedValue({ ok: false, reason: "not_member" });

    const res = await call("?code=abc");
    expect(signOutMock).toHaveBeenCalledTimes(1); // aucune session ne survit au refus
    expect(location(res)).toContain("/login?error=");
    expect(decodeURIComponent(location(res))).toContain("refus:not_member");
  });

  it("REFUSE et déconnecte si le rôle requis manque", async () => {
    checkMock.mockResolvedValue({ ok: false, reason: "missing_role" });

    const res = await call("?code=abc");
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(location(res))).toContain("refus:missing_role");
  });

  it("transmet le provider_token de la session au contrôle", async () => {
    await call("?code=abc");
    expect(checkMock).toHaveBeenCalledWith("jeton");
  });

  it("refuse sans code OAuth, sans appeler Discord", async () => {
    const res = await call("");
    expect(location(res)).toContain("/login?error=");
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("refuse si l'échange de code échoue", async () => {
    exchangeMock.mockResolvedValue({ data: { session: null }, error: { message: "bad code" } });

    const res = await call("?code=abc");
    expect(location(res)).toContain("/login?error=");
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("bloque une redirection ouverte via ?next", async () => {
    expect(location(await call("?code=abc&next=//evil.com"))).toBe(`${ORIGIN}/admin`);
    expect(location(await call("?code=abc&next=https://evil.com"))).toBe(`${ORIGIN}/admin`);
  });

  it("respecte un chemin interne dans ?next", async () => {
    expect(location(await call("?code=abc&next=/admin/rosters"))).toBe(`${ORIGIN}/admin/rosters`);
  });
});
