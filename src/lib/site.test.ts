import { describe, it, expect } from "vitest";

import { siteConfig, absoluteUrl, pageMetadata } from "@/lib/site";

describe("absoluteUrl", () => {
  it("préfixe le domaine du site à un chemin absolu", () => {
    expect(absoluteUrl("/equipes")).toBe(`${siteConfig.url}/equipes`);
  });

  it("ajoute le slash manquant sur un chemin relatif", () => {
    expect(absoluteUrl("equipes")).toBe(`${siteConfig.url}/equipes`);
  });

  it("renvoie la racine par défaut", () => {
    expect(absoluteUrl()).toBe(`${siteConfig.url}/`);
  });
});

describe("pageMetadata", () => {
  it("pose le canonical, l'Open Graph et le Twitter propres à la page", () => {
    const m = pageMetadata({ title: "Titre", description: "Desc", path: "/boutique" });

    expect(m.title).toBe("Titre");
    expect(m.description).toBe("Desc");
    expect(m.alternates?.canonical).toBe("/boutique");

    expect(m.openGraph?.title).toBe("Titre");
    expect(m.openGraph?.description).toBe("Desc");
    expect((m.openGraph as { type?: string; url?: string }).url).toBe("/boutique");
    expect((m.openGraph as { type?: string }).type).toBe("website");

    const tw = m.twitter as { card?: string; title?: string };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBe("Titre");
  });

  it("supporte le type Open Graph « article »", () => {
    const m = pageMetadata({
      title: "A",
      description: "D",
      path: "/actualite/mon-article",
      ogType: "article",
    });
    expect((m.openGraph as { type?: string }).type).toBe("article");
    expect(m.alternates?.canonical).toBe("/actualite/mon-article");
  });
});
