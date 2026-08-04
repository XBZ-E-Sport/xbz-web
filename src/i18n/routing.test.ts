// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

import { LOCALE_COOKIE, routing } from "@/i18n/routing";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cookie de langue", () => {
  it("reste en sameSite lax, sinon le retour de Discord perd la langue", () => {
    // Le retour d'OAuth est une navigation de premier niveau venue d'un AUTRE
    // domaine (Supabase → /auth/callback). En « strict » le cookie ne serait
    // pas envoyé, et le callback — qui n'a aucun autre indice de langue —
    // renverrait tout le monde en français.
    expect(LOCALE_COOKIE.sameSite).toBe("lax");
    expect(LOCALE_COOKIE.path).toBe("/");
  });

  it("est marqué Secure en production, et seulement là", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const prod = await import("@/i18n/routing");
    expect(prod.LOCALE_COOKIE.secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const dev = await import("@/i18n/routing");
    // localhost est en http : un cookie Secure n'y serait jamais posé et le
    // sélecteur de langue perdrait sa mémoire en développement.
    expect(dev.LOCALE_COOKIE.secure).toBe(false);
  });

  it("garde les deux langues préfixées dans l'URL", () => {
    expect(routing.localePrefix).toBe("always");
    expect(routing.defaultLocale).toBe("fr");
    expect([...routing.locales].sort()).toEqual(["en", "fr"]);
  });
});
