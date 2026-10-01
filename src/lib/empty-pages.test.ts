// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const data = vi.hoisted(() => ({ partners: [] as unknown[], upcoming: [] as unknown[], results: [] as unknown[], medias: [] as unknown[] }));

vi.mock("@/lib/partenaires", () => ({ getPartners: async () => data.partners }));
vi.mock("@/lib/matchs", () => ({ getMatchBoards: async () => ({ upcoming: data.upcoming, results: data.results }) }));
vi.mock("@/lib/medias", () => ({ getMedias: async () => data.medias }));

const { emptyListPages, isEmptyListPage } = await import("@/lib/empty-pages");

beforeEach(() => {
  data.partners = [];
  data.upcoming = [];
  data.results = [];
  data.medias = [];
});

describe("pages de liste vides", () => {
  it("toutes vides au départ", async () => {
    expect(await emptyListPages()).toEqual(new Set(["/partenaires", "/calendrier", "/galerie"]));
  });

  it("une page qui se remplit sort de la liste", async () => {
    data.partners = [{ id: "p1" }];
    data.medias = [{ id: "m1" }];
    expect(await emptyListPages()).toEqual(new Set(["/calendrier"]));
    expect(await isEmptyListPage("/partenaires")).toBe(false);
  });

  it("le calendrier compte les matchs à venir ET les résultats", async () => {
    data.results = [{ id: "r1" }];
    expect(await isEmptyListPage("/calendrier")).toBe(false);
    data.results = [];
    data.upcoming = [{ id: "u1" }];
    expect(await isEmptyListPage("/calendrier")).toBe(false);
  });
});
