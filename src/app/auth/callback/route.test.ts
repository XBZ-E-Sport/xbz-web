// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { exchangeMock, signOutMock, checkMock, markMock, clearMock, jar } = vi.hoisted(() => ({
  exchangeMock: vi.fn(),
  signOutMock: vi.fn(),
  checkMock: vi.fn(),
  markMock: vi.fn(),
  clearMock: vi.fn(),
  // Cookies du navigateur au retour de Discord.
  jar: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
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
  markDiscordStaff: (...a: unknown[]) => markMock(...a),
  clearDiscordStaff: (...a: unknown[]) => clearMock(...a),
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
  checkMock.mockReset().mockResolvedValue({ ok: true, roles: ["role-admin"] });
  markMock.mockReset();
  clearMock.mockReset();
  jar.clear();
});

describe("GET /auth/callback", () => {
  it("laisse entrer un membre au rôle autorisé et mémorise le verdict", async () => {
    const res = await call("?code=abc&next=/admin");
    expect(location(res)).toBe(`${ORIGIN}/admin`);
    expect(signOutMock).not.toHaveBeenCalled();
    // Sans cet enregistrement, l'accès au back-office dépendrait encore de la
    // liste email : c'est lui qui rend le rôle Discord suffisant.
    expect(markMock).toHaveBeenCalledWith("u1", ["role-admin"]);
  });

  it("REFUSE et déconnecte si la personne n'est pas sur le serveur", async () => {
    checkMock.mockResolvedValue({ ok: false, reason: "not_member" });

    const res = await call("?code=abc");
    expect(signOutMock).toHaveBeenCalledTimes(1); // aucune session ne survit au refus
    expect(clearMock).toHaveBeenCalledWith("u1"); // et l'accès staff est retiré
    expect(markMock).not.toHaveBeenCalled();
    expect(location(res)).toContain("/login?error=");
    expect(decodeURIComponent(location(res))).toContain("refus:not_member");
  });

  it("REFUSE et déconnecte si le rôle requis manque", async () => {
    checkMock.mockResolvedValue({ ok: false, reason: "missing_role" });

    const res = await call("?code=abc");
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearMock).toHaveBeenCalledWith("u1");
    expect(decodeURIComponent(location(res))).toContain("refus:missing_role");
  });

  it("ne retire PAS l'accès quand Discord est en panne", async () => {
    checkMock.mockResolvedValue({ ok: false, reason: "error" });

    await call("?code=abc");
    // Une coupure Discord ne doit pas dégrader tout le staff au passage.
    expect(clearMock).not.toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalledTimes(1);
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
    // Repli = back-office dans la langue par défaut, jamais un domaine externe.
    expect(location(await call("?code=abc&next=//evil.com"))).toBe(`${ORIGIN}/fr/admin`);
    expect(location(await call("?code=abc&next=https://evil.com"))).toBe(`${ORIGIN}/fr/admin`);
  });

  it("respecte un chemin interne dans ?next", async () => {
    expect(location(await call("?code=abc&next=/fr/admin/rosters"))).toBe(
      `${ORIGIN}/fr/admin/rosters`,
    );
  });

  it("renvoie dans la langue du cookie, sans aucun paramètre d'URL", async () => {
    // C'est TOUT le mécanisme : l'URL de callback doit rester identique au
    // caractère près à celle déclarée chez Supabase (sinon la correspondance
    // échoue et le code OAuth part sur l'accueil). Le cookie est donc la seule
    // source de langue au retour de Discord.
    jar.set("XBZ_LOCALE", "en");
    expect(location(await call("?code=abc"))).toBe(`${ORIGIN}/en/admin`);
  });

  it("garde la langue du cookie en cas de refus", async () => {
    // Un staff anglophone refusé ne doit pas atterrir sur /fr/login.
    jar.set("XBZ_LOCALE", "en");
    checkMock.mockResolvedValue({ ok: false, reason: "missing_role" });
    expect(location(await call("?code=abc"))).toContain(`${ORIGIN}/en/login?error=`);
  });

  it("retombe sur le français sans cookie, ou avec un cookie fantaisiste", async () => {
    expect(location(await call("?code=abc"))).toBe(`${ORIGIN}/fr/admin`);

    jar.set("XBZ_LOCALE", "de");
    expect(location(await call("?code=abc"))).toBe(`${ORIGIN}/fr/admin`);
  });

  it("laisse ?next primer sur le cookie quand il porte une langue", async () => {
    // Un lien profond reste explicite : il gagne contre la mémoire du cookie.
    jar.set("XBZ_LOCALE", "fr");
    expect(location(await call("?code=abc&next=/en/admin/rosters"))).toBe(
      `${ORIGIN}/en/admin/rosters`,
    );
  });
});
