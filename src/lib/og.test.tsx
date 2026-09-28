// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { clamp, ogHomeImage, ogImage } from "@/lib/og";

/**
 * Bannières Open Graph : polices de la charte embarquées (TTF + licence OFL),
 * textes coupés proprement, et un VRAI rendu — si une police manque ou ne se
 * charge pas, c'est ici que ça casse, pas sur la carte de partage en prod.
 */

const ASSETS = join(process.cwd(), "src", "assets", "og");
const FONTS = [
  ["BrunoAceSC-Regular.ttf", "OFL-brunoacesc.txt"],
  ["SpecialGothicExpandedOne-Regular.ttf", "OFL-specialgothicexpandedone.txt"],
  ["Oswald-Bold.ttf", "OFL-oswald.txt"],
  ["Sarabun-Regular.ttf", "OFL-sarabun.txt"],
  ["Sarabun-SemiBold.ttf", "OFL-sarabun.txt"],
] as const;

/** Largeur × hauteur d'un PNG (bloc IHDR). */
function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("og — polices de la charte", () => {
  it.each(FONTS)("%s : TrueType léger (sous-ensemble latin), licence OFL jointe", (font, license) => {
    const file = join(ASSETS, font);
    // 0x00010000 = en-tête sfnt TrueType (next/og ne lit ni le WOFF2 ni next/font).
    expect(readFileSync(file).subarray(0, 4).toString("hex")).toBe("00010000");
    expect(statSync(file).size).toBeLessThan(60_000);
    expect(readFileSync(join(ASSETS, license), "utf8")).toMatch(/SIL OPEN FONT LICENSE/i);
  });

  it("les images de marque existent", () => {
    for (const img of ["logo-xbz-wide.png", "corbeau.png"]) {
      expect(existsSync(join(process.cwd(), "public", img)), img).toBe(true);
    }
  });
});

describe("og — clamp", () => {
  it("laisse un texte court intact", () => {
    expect(clamp("  Le club XBZ ", 80)).toBe("Le club XBZ");
  });

  it("coupe sur une fin de mot, sans ponctuation orpheline", () => {
    const out = clamp("Une victoire historique en finale régionale : nos joueurs décrochent le titre", 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out).toBe("Une victoire historique en finale régionale…");
  });

  it("coupe au caractère quand le texte n'a pas d'espace utile", () => {
    expect(clamp("a".repeat(30), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("og — rendu", () => {
  it("rend une bannière de page 1200×630 avec les polices de la charte", async () => {
    const res = await ogImage({
      eyebrow: "Compétition",
      title: "Une victoire historique : œuvre collective, « à l’arrache » !",
      subtitle: "Menés deux manches à zéro, les joueurs d’XBZ ont renversé la finale — 12 € de goodies à gagner.",
      accent: "#f4a79b",
    });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(pngSize(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 1200, height: 630 });
  }, 30_000);

  it("rend la bannière d'accueil 1200×630", async () => {
    const res = await ogHomeImage({
      subtitle: "Structure esport compétitive · Rocket League",
      slogan: "From Zero To Legend",
      cta: "Nous rejoindre",
    });
    expect(pngSize(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 1200, height: 630 });
  }, 30_000);
});
