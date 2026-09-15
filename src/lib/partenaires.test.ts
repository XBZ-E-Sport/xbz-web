// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Vérifie le chemin RÉEL des données : requête Supabase → mapper → partenaire
 * affichable. On s'assure que les bonnes colonnes sont demandées, que le repli
 * de traduction est câblé, et que le `type` est normalisé (garde-fou d'affichage).
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
        // Chaîne « thenable » : encaisse .eq() / .order() (deux tris ici) puis
        // se résout comme une promesse à l'await.
        const chain = {
          eq: () => chain,
          order: () => chain,
          then: (resolve: (v: { data: unknown; error: null }) => void) =>
            resolve({ data: rows.value, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

// `unstable_cache` mémoïse entre les tests et fausserait les cas suivants.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const { getPartners } = await import("@/lib/partenaires");

const BASE = {
  id: "1",
  name: "Acme",
  type: "sponsor",
  description: "Équipementier officiel",
  logo: "https://x.supabase.co/logo.webp",
  url: "https://acme.example",
};

beforeEach(() => {
  rows.value = [];
  selected.value = "";
});

describe("partenaires", () => {
  it("demande la colonne de traduction à Supabase", async () => {
    rows.value = [{ ...BASE, description_en: null }];
    await getPartners("fr");
    expect(selected.value).toContain("description_en");
  });

  it("rend l'anglais quand la traduction existe", async () => {
    rows.value = [{ ...BASE, description_en: "Official kit supplier" }];
    const [p] = await getPartners("en");
    expect(p.description).toBe("Official kit supplier");
  });

  it("retombe sur le français quand rien n'est traduit", async () => {
    rows.value = [{ ...BASE, description_en: null }];
    const [p] = await getPartners("en");
    expect(p.description).toBe("Équipementier officiel");
  });

  it("normalise un type inconnu vers « partenaire »", async () => {
    rows.value = [{ ...BASE, type: "n'importe quoi", description_en: null }];
    const [p] = await getPartners("fr");
    expect(p.type).toBe("partenaire");
  });

  it("conserve le type « sponsor »", async () => {
    rows.value = [{ ...BASE, description_en: null }];
    const [p] = await getPartners("fr");
    expect(p.type).toBe("sponsor");
  });
});
