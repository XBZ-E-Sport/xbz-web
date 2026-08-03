// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Vérifie le chemin RÉEL des données : requête Supabase → mapper → article
 * affichable. Les tests de `localized.ts` couvrent la règle de repli en
 * isolation ; ici on s'assure qu'elle est bien câblée, que les bonnes colonnes
 * sont demandées, et qu'une base pas encore migrée ne casse rien.
 */

const { rows, selected } = vi.hoisted(() => ({
  rows: { value: [] as unknown[] },
  selected: { value: "" },
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: () => ({
      select: (cols: string) => {
        selected.value = cols;
        const chain = {
          eq: () => chain,
          order: () => Promise.resolve({ data: rows.value, error: null }),
          maybeSingle: () => Promise.resolve({ data: rows.value[0] ?? null, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

// `unstable_cache` mémoïse entre les tests et fausserait les cas suivants :
// on le neutralise, le comportement du cache n'est pas l'objet ici.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const { getArticles, getArticleBySlug } = await import("@/lib/actualite");

const FR = {
  slug: "recrutement-ouvert",
  title: "Le recrutement est ouvert",
  excerpt: "Une phrase d'accroche.",
  content: ["Premier paragraphe.", "Second paragraphe."],
  category: "Recrutement",
  author: "Staff XBZ",
  date: "2026-07-14",
};

beforeEach(() => {
  rows.value = [];
  selected.value = "";
});

describe("articles bilingues", () => {
  it("demande les colonnes de traduction à Supabase", async () => {
    rows.value = [{ ...FR, title_en: null, excerpt_en: null, content_en: null }];
    await getArticles("fr");
    for (const col of ["title_en", "excerpt_en", "content_en"]) {
      expect(selected.value).toContain(col);
    }
  });

  it("rend l'anglais quand la traduction existe", async () => {
    rows.value = [
      {
        ...FR,
        title_en: "Recruitment is open",
        excerpt_en: "A catchy line.",
        content_en: ["First paragraph.", "Second paragraph."],
      },
    ];
    const [article] = await getArticles("en");
    expect(article.title).toBe("Recruitment is open");
    expect(article.excerpt).toBe("A catchy line.");
    expect(article.content).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("rend le français sur une page anglaise quand rien n'est traduit", async () => {
    // Cas du jour de la mise en ligne : les colonnes existent mais sont vides.
    rows.value = [{ ...FR, title_en: null, excerpt_en: null, content_en: [] }];
    const [article] = await getArticles("en");
    expect(article.title).toBe("Le recrutement est ouvert");
    expect(article.content).toEqual(["Premier paragraphe.", "Second paragraphe."]);
  });

  it("traduit champ par champ : un titre anglais n'impose pas un corps anglais", async () => {
    rows.value = [{ ...FR, title_en: "Recruitment is open", excerpt_en: null, content_en: null }];
    const [article] = await getArticles("en");
    expect(article.title).toBe("Recruitment is open");
    expect(article.excerpt).toBe("Une phrase d'accroche."); // pas encore traduit
  });

  it("ignore les traductions sur la page française", async () => {
    rows.value = [{ ...FR, title_en: "Recruitment is open", excerpt_en: null, content_en: null }];
    const [article] = await getArticles("fr");
    expect(article.title).toBe("Le recrutement est ouvert");
  });

  it("tolère une ligne sans les clés de traduction", async () => {
    // ⚠️ Ceci teste le MAPPER, pas la base : Supabase est mocké ici.
    // En vrai, `select("… title_en …")` sur une base NON migrée renvoie une
    // erreur PostgREST et toute la requête échoue. La migration doit donc
    // passer AVANT ou AVEC le déploiement, jamais après.
    rows.value = [{ ...FR }];
    const [article] = await getArticles("en");
    expect(article.title).toBe("Le recrutement est ouvert");
    expect(article.content).toHaveLength(2);
  });

  it("applique la même règle à un article seul", async () => {
    rows.value = [{ ...FR, title_en: "Recruitment is open", excerpt_en: null, content_en: null }];
    expect((await getArticleBySlug(FR.slug, "en"))?.title).toBe("Recruitment is open");
    expect((await getArticleBySlug(FR.slug, "fr"))?.title).toBe("Le recrutement est ouvert");
  });
});
