// @vitest-environment node
import { describe, it, expect } from "vitest";

import type { Product } from "@/lib/boutique";
import { productJsonLd } from "@/lib/product-seo";
import { siteConfig } from "@/lib/site";

const product: Product = {
  slug: "maillot",
  name: "Maillot officiel",
  description: "Le maillot de la saison.",
  price: 49.9,
  category: "Textile",
  icon: "👕",
  image: "https://x.supabase.co/a.webp",
  images: ["https://x.supabase.co/a.webp", "http://insecure.example/b.png"],
  sizeGuide: null,
  available: true,
  personalizable: false,
  personalizationPrice: 0,
  variants: [{ id: "v1", size: "M", stock: 2 }],
};

const base = {
  product,
  locale: "en",
  path: "/boutique/maillot",
  category: "Apparel",
  description: "Le maillot de la saison.",
  purchasable: true,
  shipping: 4.9,
  countries: ["FR", "BE"] as const,
  fallbackImage: "https://www.xbz-esport.org/en/boutique/maillot/opengraph-image/abc",
};

describe("JSON-LD produit", () => {
  it("prix, devise, adresse dans la langue de la page, photos explorables seulement", () => {
    const ld = productJsonLd(base);
    expect(ld["@type"]).toBe("Product");
    expect(ld.url).toBe(`${siteConfig.url}/en/boutique/maillot`);
    expect(ld.offers.price).toBe("49.90");
    expect(ld.offers.priceCurrency).toBe("EUR");
    expect(ld.image).toEqual(["https://x.supabase.co/a.webp"]);
    expect(ld.brand.name).toBe(siteConfig.name);
  });

  it("disponibilité : en stock seulement si achetable maintenant", () => {
    expect(productJsonLd(base).offers.availability).toBe("https://schema.org/InStock");
    expect(productJsonLd({ ...base, purchasable: false }).offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("sans photo : la bannière de partage sert d'image", () => {
    const ld = productJsonLd({ ...base, product: { ...product, image: null, images: [] } });
    expect(ld.image).toEqual([base.fallbackImage]);
  });

  it("livraison et retours conformes aux CGV (14 jours, retour à la charge du client)", () => {
    const { shippingDetails, hasMerchantReturnPolicy } = productJsonLd(base).offers;
    expect(shippingDetails.shippingRate).toEqual({ "@type": "MonetaryAmount", value: "4.90", currency: "EUR" });
    expect(shippingDetails.shippingDestination.map((d) => d.addressCountry)).toEqual(["FR", "BE"]);
    expect(hasMerchantReturnPolicy.merchantReturnDays).toBe(14);
    expect(hasMerchantReturnPolicy.returnFees).toBe("https://schema.org/ReturnFeesCustomerResponsibility");
  });
});
