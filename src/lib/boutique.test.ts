// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Lecture du catalogue : colonnes demandées, photos (principale en tête, sans
 * doublon), guide des tailles traduit, et repli quand le code est déployé
 * AVANT une migration — sans jamais vider la boutique pour une panne réseau.
 */

type Reply = { data: unknown; error: { code: string; message: string } | null };
const db = vi.hoisted(() => ({ replies: [] as Reply[], selects: [] as string[] }));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: () => ({
      select: (cols: string) => {
        db.selects.push(cols);
        const reply = db.replies.shift() ?? { data: [], error: null };
        const chain = { eq: () => chain, order: () => chain, then: (resolve: (v: Reply) => void) => resolve(reply) };
        return chain;
      },
    }),
  }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }));

const { getProducts, getProductBySlug, getProductSlugs } = await import("@/lib/boutique");

const row = {
  slug: "maillot",
  name: "Maillot",
  name_en: "Jersey",
  description: "Le maillot.",
  description_en: null,
  price: "49.90",
  category: "Textile",
  icon: "👕",
  image: "https://x.supabase.co/storage/v1/object/public/products/a.webp",
  images: [
    "https://x.supabase.co/storage/v1/object/public/products/b.webp",
    "https://x.supabase.co/storage/v1/object/public/products/a.webp",
  ],
  size_guide: "S : 50 cm\nM : 53 cm",
  size_guide_en: "  ",
  available: true,
  variants: [
    { id: "v2", size: "M", stock: 1, position: 2 },
    { id: "v1", size: "S", stock: 3, position: 1 },
  ],
};

beforeEach(() => {
  db.replies = [];
  db.selects = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("catalogue", () => {
  it("photos : principale en tête, sans doublon ; guide des tailles ; tailles dans l'ordre", async () => {
    db.replies = [{ data: [row], error: null }];
    const [p] = await getProducts("fr");
    expect(db.selects[0]).toContain("images, size_guide, size_guide_en");
    expect(p.images).toEqual([row.image, row.images[0]]);
    expect(p.sizeGuide).toBe("S : 50 cm\nM : 53 cm");
    expect(p.variants.map((v) => v.size)).toEqual(["S", "M"]);
    expect(p.price).toBe(49.9);
  });

  it("anglais : nom traduit, guide vide → repli sur le français", async () => {
    db.replies = [{ data: [row], error: null }];
    const p = await getProductBySlug("maillot", "en");
    expect(p?.name).toBe("Jersey");
    expect(p?.sizeGuide).toBe("S : 50 cm\nM : 53 cm");
  });

  it("produit inconnu ou masqué : null ; slugs des produits actifs", async () => {
    db.replies = [{ data: [row], error: null }, { data: [row], error: null }];
    expect(await getProductBySlug("inconnu", "fr")).toBeNull();
    expect(await getProductSlugs()).toEqual(["maillot"]);
  });

  it("migration des pages produit pas encore passée : catalogue intact, sans photos supplémentaires", async () => {
    const old = Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("size_guide") && k !== "images"));
    db.replies = [
      { data: null, error: { code: "42703", message: "column products.images does not exist" } },
      { data: null, error: { code: "42703", message: "column products.images does not exist" } },
      { data: [old], error: null },
    ];
    const [p] = await getProducts("fr");
    expect(db.selects).toHaveLength(3);
    expect(db.selects[2]).not.toContain("images");
    expect(db.selects[2]).toContain("variants:product_variants");
    expect(p.images).toEqual([row.image]);
    expect(p.sizeGuide).toBeNull();
    expect(p.variants).toHaveLength(2);
  });

  it("personnalisation : interrupteur et supplément lus (numeric en chaîne)", async () => {
    db.replies = [{ data: [{ ...row, personalizable: true, personalization_price: "5.00" }], error: null }];
    const [p] = await getProducts("fr");
    expect(db.selects[0]).toContain("personalizable, personalization_price");
    expect(p.personalizable).toBe(true);
    expect(p.personalizationPrice).toBe(5);
  });

  it("personnalisation éteinte par défaut : colonne absente, null ou valeur étrangère", async () => {
    db.replies = [{ data: [row], error: null }, { data: [{ ...row, personalizable: null, personalization_price: null }], error: null }];
    expect((await getProducts("fr"))[0]).toMatchObject({ personalizable: false, personalizationPrice: 0 });
    expect((await getProducts("fr"))[0]).toMatchObject({ personalizable: false, personalizationPrice: 0 });
  });

  it("supplément négatif ou illisible : 0", async () => {
    db.replies = [{ data: [{ ...row, personalizable: true, personalization_price: "-3" }], error: null }];
    expect((await getProducts("fr"))[0].personalizationPrice).toBe(0);
    db.replies = [{ data: [{ ...row, personalizable: true, personalization_price: "abc" }], error: null }];
    expect((await getProducts("fr"))[0].personalizationPrice).toBe(0);
  });

  it("migration de personnalisation pas encore passée : pages produit conservées, personnalisation éteinte", async () => {
    db.replies = [
      { data: null, error: { code: "42703", message: "column products.personalizable does not exist" } },
      { data: [row], error: null },
    ];
    const [p] = await getProducts("fr");
    expect(db.selects).toHaveLength(2);
    expect(db.selects[1]).not.toContain("personalizable");
    expect(db.selects[1]).toContain("images, size_guide, size_guide_en");
    expect(p.personalizable).toBe(false);
    expect(p.images).toHaveLength(2);
  });

  it("table des tailles absente aussi : produits affichés, rien en vente", async () => {
    db.replies = [
      { data: null, error: { code: "42703", message: "column" } },
      { data: null, error: { code: "PGRST200", message: "relationship" } },
      { data: [{ ...row, variants: undefined }], error: null },
    ];
    const [p] = await getProducts("fr");
    expect(db.selects).toHaveLength(3);
    expect(p.variants).toEqual([]);
  });

  it("panne (réseau, droits) : pas de nouvelles tentatives, liste vide", async () => {
    db.replies = [{ data: null, error: { code: "", message: "fetch failed" } }];
    expect(await getProducts("fr")).toEqual([]);
    expect(db.selects).toHaveLength(1);
  });
});
