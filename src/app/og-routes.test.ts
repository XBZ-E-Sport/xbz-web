// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

/**
 * Bannières Open Graph : chaque page publique a la sienne, et son adresse est
 * VERSIONNÉE (`generateImageMetadata`).
 *
 * Sans identifiant, l'adresse d'une image `opengraph-image` ne change jamais
 * (son `?<hash>` vient du fichier de la route, pas de l'image) : Discord, X ou
 * Facebook ressortaient indéfiniment l'ancienne bannière. Une route ajoutée
 * sans `generateImageMetadata` retomberait dans ce piège sans bruit.
 */

const LOCALE_DIR = join(process.cwd(), "src", "app", "[locale]");
// Hors du site public : pas de carte de partage à soigner (et `noindex`).
const PRIVATE = ["admin", "login", "[...rest]"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const rel = (file: string) => relative(LOCALE_DIR, file).split(sep).join("/");
const isPrivate = (file: string) => PRIVATE.includes(rel(file).split("/")[0]);
/** Sous un segment dynamique autre que [locale] : contenu lu en base. */
const isDynamic = (file: string) => /\[[^\]]+\]/.test(rel(dirname(file)));

const files = walk(LOCALE_DIR);
const pages = files.filter((f) => f.endsWith(`${sep}page.tsx`) && !isPrivate(f));
const ogRoutes = files.filter((f) => f.endsWith(`${sep}opengraph-image.tsx`));
const source = (file: string) =>
  readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("bannières Open Graph", () => {
  it("le recensement voit bien les pages et les bannières", () => {
    expect(pages.length).toBeGreaterThan(15);
    expect(ogRoutes.length).toBeGreaterThan(15);
  });

  it.each(pages.map((p) => [rel(p)]))("%s a sa propre bannière", (page) => {
    expect(existsSync(join(LOCALE_DIR, dirname(page), "opengraph-image.tsx"))).toBe(true);
  });

  it.each(ogRoutes.map((f) => [rel(f), f]))("%s : adresse versionnée", (_, file) => {
    const code = source(file);
    expect(code).toMatch(/export (const|async function|function) generateImageMetadata\b/);
    // Avec generateImageMetadata, ces exports seraient ignorés : le texte
    // alternatif doit venir de generateImageMetadata (traduit), pas d'ici.
    expect(code).not.toMatch(/export const (alt|size|contentType)\b/);
  });

  it.each(ogRoutes.map((f) => [rel(f), f]))("%s : rendu adapté à sa source", (_, file) => {
    const code = source(file);
    if (isDynamic(file)) {
      // Contenu lu en base, à jour à chaque partage.
      expect(code).toMatch(/export const dynamic = "force-dynamic"/);
    } else {
      // Textes fixes : rendue une fois par langue, puis servie depuis le cache.
      expect(code).toMatch(/export const dynamic = "force-static"/);
    }
    // Next remplace le `generateStaticParams` d'une route d'image versionnée
    // par le sien : en écrire un ne servirait à rien et tromperait le lecteur.
    expect(code).not.toMatch(/export (async )?function generateStaticParams\b/);
  });

  it("chaque clé de bannière fixe existe en français et en anglais", () => {
    type Og = Record<string, Record<string, string>>;
    const keys = ogRoutes.flatMap((f) => [...source(f).matchAll(/pageOgRoute\("([^"]+)"\)/g)].map((m) => m[1]));
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      for (const messages of [fr, en]) {
        const og = (messages as unknown as { og: Og }).og[key];
        expect(og, key).toBeDefined();
        for (const field of ["eyebrow", "title", "subtitle"]) {
          expect(og[field], `${key}.${field}`).toEqual(expect.any(String));
        }
      }
    }
  });
});
