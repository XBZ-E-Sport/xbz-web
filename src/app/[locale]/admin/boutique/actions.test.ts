// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls = vi.hoisted(() => ({ productUpdates: [] as Record<string, unknown>[], productInserts: [] as Record<string, unknown>[] }));

/** Faux client Supabase : enregistre ce qui est écrit dans `products`. */
vi.mock("@/lib/adminguard", () => ({
  assertStaff: async () => ({
    from: (table: string) => {
      if (table === "products") {
        return {
          // uniqueProductSlug : aucun slug pris
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          update: (patch: Record<string, unknown>) => {
            calls.productUpdates.push(patch);
            return { eq: async () => ({ error: null }) };
          },
          insert: (row: Record<string, unknown>) => {
            calls.productInserts.push(row);
            return { select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }) };
          },
        };
      }
      // product_variants : tout réussit
      return {
        update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: "v" }], error: null }) }) }) }),
        insert: async () => ({ error: null }),
        delete: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
      };
    },
  }),
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: <T,>(fn: T) => fn, // importé par lib/boutique (lecture publique), non utilisé ici
}));
vi.mock("@/lib/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cache")>()),
  revalidateLocalizedPath: vi.fn(),
}));
vi.mock("@/lib/storage-image", () => ({ processAndUploadImage: vi.fn(async () => "https://cdn.test/uploaded.png") }));

import { createProduct, updateProduct } from "./actions";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

function form(fields: Record<string, string | File>) {
  const fd = new FormData();
  fd.set("name", "Maillot");
  fd.set("price", "49,99");
  fd.set("category", "Textile");
  fd.append("variant_id", "");
  fd.append("variant_size", "M");
  fd.append("variant_stock", "3");
  fd.append("variant_stock_orig", "");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  calls.productUpdates.length = 0;
  calls.productInserts.length = 0;
});

describe("updateProduct — photo principale", () => {
  it("formulaire resté ouvert (photo inchangée) : ne réécrit PAS la photo principale", async () => {
    // Entre-temps, « En principale » a changé la photo en base. Ce formulaire
    // affichait encore l'ancienne et la renverrait telle quelle.
    const result = await updateProduct(
      form({ id: PRODUCT, image_url: "https://cdn.test/ancienne.png", image_orig: "https://cdn.test/ancienne.png" }),
    );
    expect(result).toBeUndefined();
    expect(calls.productUpdates).toHaveLength(1);
    expect(calls.productUpdates[0]).not.toHaveProperty("image");
  });

  it("URL modifiée à la main : la nouvelle est enregistrée", async () => {
    await updateProduct(
      form({ id: PRODUCT, image_url: "https://cdn.test/nouvelle.png", image_orig: "https://cdn.test/ancienne.png" }),
    );
    expect(calls.productUpdates[0]).toMatchObject({ image: "https://cdn.test/nouvelle.png" });
  });

  it("URL effacée : la photo principale est retirée (le staff l'a voulu)", async () => {
    await updateProduct(form({ id: PRODUCT, image_url: "", image_orig: "https://cdn.test/ancienne.png" }));
    expect(calls.productUpdates[0]).toMatchObject({ image: null });
  });

  it("fichier envoyé : il est prioritaire, même si l'URL n'a pas changé", async () => {
    const file = new File([new Uint8Array(10)], "photo.png", { type: "image/png" });
    await updateProduct(
      form({ id: PRODUCT, image_url: "https://cdn.test/ancienne.png", image_orig: "https://cdn.test/ancienne.png", image_file: file }),
    );
    expect(calls.productUpdates[0]).toMatchObject({ image: "https://cdn.test/uploaded.png" });
  });

  it("produit sans photo : une URL saisie est enregistrée", async () => {
    await updateProduct(form({ id: PRODUCT, image_url: "https://cdn.test/premiere.png", image_orig: "" }));
    expect(calls.productUpdates[0]).toMatchObject({ image: "https://cdn.test/premiere.png" });
  });
});

describe("createProduct", () => {
  it("écrit toujours la photo saisie (rien à protéger)", async () => {
    await createProduct(form({ image_url: "https://cdn.test/a.png" }));
    expect(calls.productInserts[0]).toMatchObject({ image: "https://cdn.test/a.png" });
  });
});

describe("stock vidé", () => {
  it("est refusé avec un message, et n'écrit rien", async () => {
    const result = await updateProduct(form({ id: PRODUCT, variant_stock: "" }));
    expect(result).toEqual({ error: expect.stringMatching(/Stock manquant pour la taille « M »/) });
    expect(calls.productUpdates).toHaveLength(0);
  });
});

describe("personnalisation (interrupteur et supplément)", () => {
  it("case cochée : activée, supplément en euros arrondi au centime", async () => {
    await updateProduct(form({ id: PRODUCT, personalizable: "on", personalization_price: "5,5" }));
    expect(calls.productUpdates[0]).toMatchObject({ personalizable: true, personalization_price: 5.5 });
  });

  it("case décochée (absente du formulaire) : éteinte — l'interrupteur se coupe d'un clic", async () => {
    await updateProduct(form({ id: PRODUCT, personalization_price: "5" }));
    expect(calls.productUpdates[0]).toMatchObject({ personalizable: false, personalization_price: 5 });
  });

  it("« 5 € » et « 7,50 » acceptés ; champ vide = pas de supplément", async () => {
    await updateProduct(form({ id: PRODUCT, personalizable: "on", personalization_price: "5 €" }));
    await updateProduct(form({ id: PRODUCT, personalizable: "on", personalization_price: "7,50" }));
    await updateProduct(form({ id: PRODUCT, personalizable: "on", personalization_price: "" }));
    expect(calls.productUpdates.map((u) => u.personalization_price)).toEqual([5, 7.5, 0]);
  });

  it.each([
    ["trop élevé", "150", /100 € au plus/],
    ["négatif", "-4", /illisible/],
    ["illisible", "beaucoup", /illisible/],
  ])("supplément %s : refusé avec un message, rien n'est écrit", async (_label, value, message) => {
    const result = await updateProduct(form({ id: PRODUCT, personalizable: "on", personalization_price: value }));
    expect(result).toEqual({ error: expect.stringMatching(message) });
    expect(calls.productUpdates).toHaveLength(0);
  });

  it("formulaire sans le réglage (migration pas passée) : colonnes jamais écrites", async () => {
    await updateProduct(form({ id: PRODUCT }));
    expect(calls.productUpdates[0]).not.toHaveProperty("personalizable");
    expect(calls.productUpdates[0]).not.toHaveProperty("personalization_price");
  });

  it("création : le réglage est écrit comme pour une modification", async () => {
    await createProduct(form({ personalizable: "on", personalization_price: "8" }));
    expect(calls.productInserts[0]).toMatchObject({ personalizable: true, personalization_price: 8 });
  });
});

