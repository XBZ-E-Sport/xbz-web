// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { siteConfig } from "@/lib/site";

/**
 * Sitemap : ce qu'il propose à Google doit concorder avec ce que disent les
 * pages (pas de page `noindex` proposée, hreflang identique) et ses dates
 * doivent être vraies — une date qui bouge à chaque lecture apprend à Google à
 * ignorer toutes les autres.
 */

const data = vi.hoisted(() => ({
  articles: [{ slug: "victoire", date: "2026-09-20" }],
  offers: [{ slug: "dev-web", datePosted: "2026-09-07" }],
  equipes: ["/equipes/ssl", "/equipes/vide", "/equipes/ssl/alpha"] as string[],
  empty: new Set<string>(["/calendrier"]),
  products: ["maillot-officiel"] as string[],
}));

vi.mock("@/lib/actualite", () => ({ getArticles: async () => data.articles }));
vi.mock("@/lib/offres", () => ({ getOffers: async () => data.offers }));
vi.mock("@/lib/equipes", () => ({ getEquipesUrls: async () => data.equipes }));
vi.mock("@/lib/empty-pages", () => ({ emptyListPages: async () => data.empty }));
vi.mock("@/lib/boutique", () => ({ getProductSlugs: async () => data.products }));

const { default: sitemap } = await import("@/app/sitemap");
const u = (path: string) => `${siteConfig.url}${path}`;

beforeEach(() => {
  data.equipes = ["/equipes/ssl", "/equipes/vide", "/equipes/ssl/alpha"];
  data.empty = new Set(["/calendrier"]);
});

describe("sitemap", () => {
  it("chaque page existe dans les deux langues, avec un hreflang complet (x-default compris)", async () => {
    const entries = await sitemap();
    const club = entries.filter((e) => e.url.endsWith("/le-club"));
    expect(club.map((e) => e.url)).toEqual([u("/fr/le-club"), u("/en/le-club")]);
    for (const e of club) {
      expect(e.alternates?.languages).toEqual({
        fr: u("/fr/le-club"),
        en: u("/en/le-club"),
        "x-default": u("/fr/le-club"),
      });
    }
  });

  it("ne date que ce qui a une vraie date : articles et offres", async () => {
    const entries = await sitemap();
    const dated = entries.filter((e) => e.lastModified !== undefined).map((e) => e.url);
    expect(dated.sort()).toEqual(
      [
        u("/fr/actualite/victoire"),
        u("/en/actualite/victoire"),
        u("/fr/carrieres/dev-web"),
        u("/en/carrieres/dev-web"),
      ].sort(),
    );
    const article = entries.find((e) => e.url === u("/fr/actualite/victoire"));
    expect(new Date(article!.lastModified!).toISOString().slice(0, 10)).toBe("2026-09-20");
  });

  it("ne propose pas une page de liste vide (en noindex)", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).not.toContain(u("/fr/calendrier"));
    expect(urls).toContain(u("/fr/galerie"));
  });

  it("ne propose pas une équipe sans membre, mais garde ses voisines et leurs membres", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(u("/fr/equipes/ssl"));
    expect(urls).toContain(u("/fr/equipes/ssl/alpha"));
    expect(urls).not.toContain(u("/fr/equipes/vide"));
  });

  it("garde toutes les équipes si aucun membre n'a pu être lu (lecture en échec, pas club vide)", async () => {
    data.equipes = ["/equipes/ssl", "/equipes/vide"];
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(u("/fr/equipes/ssl"));
    expect(urls).toContain(u("/fr/equipes/vide"));
  });

  it("propose chaque page produit dans les deux langues, sans fausse date", async () => {
    const entries = await sitemap();
    const product = entries.filter((e) => e.url.endsWith("/boutique/maillot-officiel"));
    expect(product.map((e) => e.url)).toEqual([u("/fr/boutique/maillot-officiel"), u("/en/boutique/maillot-officiel")]);
    expect(product.every((e) => e.lastModified === undefined)).toBe(true);
    expect(product[0].alternates?.languages).toMatchObject({ "x-default": u("/fr/boutique/maillot-officiel") });
  });
});
