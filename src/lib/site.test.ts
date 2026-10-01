import { describe, it, expect, vi } from "vitest";

import { siteConfig, absoluteUrl, localizedPath, pageMetadata } from "@/lib/site";

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

describe("localizedPath", () => {
  it("préfixe chaque langue, français compris", () => {
    expect(localizedPath("/equipes", "fr")).toBe("/fr/equipes");
    expect(localizedPath("/equipes", "en")).toBe("/en/equipes");
  });

  it("ne laisse pas de slash final sur la racine d'une langue", () => {
    expect(localizedPath("/", "fr")).toBe("/fr");
    expect(localizedPath("/", "en")).toBe("/en");
  });
});

describe("pageMetadata", () => {
  it("pose le canonical, l'Open Graph et le Twitter propres à la page", () => {
    const m = pageMetadata({ title: "Titre", description: "Desc", path: "/boutique" });

    expect(m.title).toBe("Titre");
    expect(m.description).toBe("Desc");
    // Sans `locale`, on retombe sur le français — la langue par défaut du site.
    expect(m.alternates?.canonical).toBe("/fr/boutique");

    expect(m.openGraph?.title).toBe("Titre");
    expect(m.openGraph?.description).toBe("Desc");
    expect((m.openGraph as { type?: string; url?: string }).url).toBe("/fr/boutique");
    expect((m.openGraph as { type?: string }).type).toBe("website");

    const tw = m.twitter as { card?: string; title?: string };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBe("Titre");
  });

  it("préfixe le canonical avec la langue demandée", () => {
    const m = pageMetadata({ title: "T", description: "D", path: "/boutique", locale: "en" });
    expect(m.alternates?.canonical).toBe("/en/boutique");
    expect((m.openGraph as { locale?: string }).locale).toBe("en_US");
  });

  it("déclare les deux langues en hreflang, plus x-default, quelle que soit la page rendue", () => {
    // Sans ces alternates, Google verrait deux pages concurrentes au lieu d'une
    // même page en deux langues. `x-default` : la version des autres langues.
    for (const locale of ["fr", "en"]) {
      const m = pageMetadata({ title: "T", description: "D", path: "/boutique", locale });
      expect(m.alternates?.languages).toEqual({
        fr: "/fr/boutique",
        en: "/en/boutique",
        "x-default": "/fr/boutique",
      });
    }
  });

  it("reste indexable par défaut, et sort de l'index sur demande (liens suivis)", () => {
    expect(pageMetadata({ title: "T", description: "D", path: "/galerie" }).robots).toBeUndefined();
    const m = pageMetadata({ title: "T", description: "D", path: "/galerie", noindex: true });
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it("date un article (article:published_time), et seulement un article", () => {
    const article = pageMetadata({
      title: "A",
      description: "D",
      path: "/actualite/a",
      ogType: "article",
      publishedTime: "2026-09-01",
    });
    expect((article.openGraph as { publishedTime?: string }).publishedTime).toBe("2026-09-01");

    const page = pageMetadata({ title: "A", description: "D", path: "/boutique", publishedTime: "2026-09-01" });
    expect((page.openGraph as { publishedTime?: string }).publishedTime).toBeUndefined();
  });

  it("supporte le type Open Graph « article »", () => {
    const m = pageMetadata({
      title: "A",
      description: "D",
      path: "/actualite/mon-article",
      ogType: "article",
      locale: "en",
    });
    expect((m.openGraph as { type?: string }).type).toBe("article");
    expect(m.alternates?.canonical).toBe("/en/actualite/mon-article");
  });
});

describe("siteConfig.url", () => {
  it("retombe sur le domaine de production si la variable manque", async () => {
    // L'ancien repli (`xbz-web.vercel.app`) faisait du site un doublon de
    // lui-même aux yeux de Google le jour où la variable manquait.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);
    vi.resetModules();
    try {
      const { siteConfig: fresh } = await import("@/lib/site");
      expect(fresh.url).toBe("https://www.xbz-esport.org");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("retire le slash final de la variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://exemple.test/");
    vi.resetModules();
    try {
      const { siteConfig: fresh } = await import("@/lib/site");
      expect(fresh.url).toBe("https://exemple.test");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
