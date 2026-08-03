// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou : une page `force-static` DOIT passer la langue explicitement.
 *
 * Sous `export const dynamic = "force-static"`, la page est rendue au build,
 * hors de toute requête. `getTranslations()` sans argument et `useTranslations()`
 * n'ont alors aucune langue « ambiante » à lire : ils retombent silencieusement
 * sur le français, et la version anglaise part en ligne en français — sans
 * aucune erreur, ni au build, ni au runtime. Seule la forme explicite
 * `getTranslations({ locale, namespace })` est fiable dans ce mode.
 *
 * Ce test échoue si une page prérendue oublie la règle, ou si une nouvelle page
 * passe en `force-static` sans être adaptée.
 */

const APP = join(process.cwd(), "src", "app", "[locale]");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

const pages = pageFiles(APP).map((file) => ({
  file,
  // Chemin lisible dans le message d'échec (ex. "le-club/page.tsx").
  label: file.slice(APP.length + 1),
  source: readFileSync(file, "utf8"),
}));

const staticPages = pages.filter((p) => p.source.includes('dynamic = "force-static"'));

describe("pages prérendues (force-static)", () => {
  it("en trouve au moins une (sinon ce test ne garde plus rien)", () => {
    expect(staticPages.length).toBeGreaterThan(0);
  });

  it("passe toujours la langue à getTranslations", () => {
    // `getTranslations("ns")` → interdit ; `getTranslations({ locale, ... })` → OK.
    const implicit = staticPages.filter((p) => /getTranslations\(\s*["'`]/.test(p.source));
    expect(implicit.map((p) => p.label)).toEqual([]);
  });

  it("n'utilise pas useTranslations, qui lit un contexte inexistant au build", () => {
    const hooked = staticPages.filter((p) => p.source.includes("useTranslations"));
    expect(hooked.map((p) => p.label)).toEqual([]);
  });

  it("passe la langue à chaque <Link>", () => {
    // Même piège que pour les traductions : un `<Link>` sans `locale` renvoie
    // vers `/fr/…` depuis une page anglaise prérendue.
    const offenders = staticPages.flatMap((p) =>
      [...p.source.matchAll(/<Link\b[\s\S]*?>/g)]
        .filter((m) => !m[0].includes("locale={locale}"))
        .map(() => p.label),
    );
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("appelle setRequestLocale sur toutes les pages publiques", () => {
    // Sans cet appel, toute page qui lit une traduction bascule en rendu à la
    // demande. Le back-office en est exempté : il n'est pas traduit (staff
    // francophone) et il est de toute façon `force-dynamic`.
    const publicPages = pages.filter((p) => !p.label.startsWith("admin/"));
    const missing = publicPages.filter((p) => !p.source.includes("setRequestLocale"));
    expect(missing.map((p) => p.label)).toEqual([]);
  });
});
