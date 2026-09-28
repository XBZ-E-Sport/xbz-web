// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fous de sécurité de la config Next :
 * - l'optimiseur d'images (/_next/image) ne traite que les images du projet
 *   Supabase du site, jamais celles de n'importe quel `*.supabase.co` ;
 * - Next et sharp ne redescendent pas sous les versions qui corrigent la RCE
 *   de l'optimiseur (GHSA-2xp9-vwfh-vxw4) et les failles libheif de sharp.
 */

const ENV = "NEXT_PUBLIC_SUPABASE_URL";
const original = process.env[ENV];

async function loadConfig(url: string | undefined) {
  if (url === undefined) delete process.env[ENV];
  else process.env[ENV] = url;
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  return config;
}

afterEach(() => {
  if (original === undefined) delete process.env[ENV];
  else process.env[ENV] = original;
});

describe("next.config — images distantes", () => {
  it("n'autorise que l'hôte du projet Supabase, en https, sur le stockage public", async () => {
    const config = await loadConfig("https://abcd1234.supabase.co");
    expect(config.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "abcd1234.supabase.co", pathname: "/storage/v1/object/public/**" },
    ]);
  });

  it("aucun joker d'hôte", async () => {
    const config = await loadConfig("https://abcd1234.supabase.co");
    for (const p of config.images?.remotePatterns ?? []) {
      const hostname = p instanceof URL ? p.hostname : p.hostname;
      expect(hostname).not.toMatch(/\*/);
    }
  });

  it.each([undefined, "", "pas une url"])("échec fermé si l'URL Supabase manque ou est invalide (%j)", async (url) => {
    const config = await loadConfig(url);
    expect(config.images?.remotePatterns).toEqual([]);
  });
});

describe("dépendances — versions corrigées", () => {
  const version = (pkg: string) =>
    (JSON.parse(readFileSync(join(process.cwd(), "node_modules", pkg, "package.json"), "utf8")) as { version: string })
      .version.split(".")
      .map(Number);
  const atLeast = (v: number[], min: number[]) => {
    for (let i = 0; i < min.length; i++) if ((v[i] ?? 0) !== min[i]) return (v[i] ?? 0) > min[i];
    return true;
  };

  it("next ≥ 16.3.3 (RCE de l'optimiseur d'images via AVIF)", () => {
    expect(atLeast(version("next"), [16, 3, 3]), version("next").join(".")).toBe(true);
  });

  it("sharp ≥ 0.35.4 (failles libheif)", () => {
    expect(atLeast(version("sharp"), [0, 35, 4]), version("sharp").join(".")).toBe(true);
  });
});
