// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Chemin réel des données : requête Supabase → mapper → média affichable.
 * On vérifie les colonnes demandées et la normalisation type/catégorie
 * (garde-fous d'affichage).
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
          order: () => chain,
          then: (resolve: (v: { data: unknown; error: null }) => void) =>
            resolve({ data: rows.value, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const { getMedias } = await import("@/lib/medias");

const base = { id: "1", type: "photo", title: "Finale", category: "matches", image: "x", video_url: null };

beforeEach(() => {
  rows.value = [];
  selected.value = "";
});

describe("medias", () => {
  it("demande les colonnes attendues", async () => {
    rows.value = [base];
    await getMedias();
    for (const col of ["type", "category", "image", "video_url"]) {
      expect(selected.value).toContain(col);
    }
  });

  it("conserve un type et une catégorie valides", async () => {
    rows.value = [{ ...base, type: "video", category: "creation", video_url: "https://y" }];
    const [m] = await getMedias();
    expect(m.type).toBe("video");
    expect(m.category).toBe("creation");
    expect(m.videoUrl).toBe("https://y");
  });

  it("normalise un type inconnu vers « photo »", async () => {
    rows.value = [{ ...base, type: "gif" }];
    expect((await getMedias())[0].type).toBe("photo");
  });

  it("normalise une catégorie inconnue vers « events »", async () => {
    rows.value = [{ ...base, category: "n-importe-quoi" }];
    expect((await getMedias())[0].category).toBe("events");
  });
});
