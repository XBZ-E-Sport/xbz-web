// JSON-LD schema.org d'une page produit : ce que Google lit pour afficher le
// prix, la disponibilité, la livraison et les retours dans ses résultats.
// Fonction pure (aucune lecture) : testable, et la page lui passe tout.

import type { Product } from "@/lib/boutique";
import { absoluteUrl, localizedPath, siteConfig } from "@/lib/site";

const SCHEMA = "https://schema.org/";

export type ProductJsonLdInput = {
  product: Product;
  locale: string;
  /** Chemin SANS langue (« /boutique/maillot »). */
  path: string;
  /** Libellé de catégorie, traduit. */
  category: string;
  description: string;
  /** Achetable maintenant sur le site : boutique ouverte, produit en vente, en stock. */
  purchasable: boolean;
  /** Frais de port par commande, en euros. */
  shipping: number;
  /** Pays de livraison (ISO 3166-1 alpha-2). */
  countries: readonly string[];
  /** Image de repli (bannière de partage) quand le produit n'a pas de photo. */
  fallbackImage: string;
};

export function productJsonLd(input: ProductJsonLdInput) {
  const { product, locale, path, category, description, purchasable, shipping, countries, fallbackImage } = input;
  const url = absoluteUrl(localizedPath(path, locale));
  // Google n'accepte que des images explorables : URL absolues en https.
  const photos = product.images.filter((src) => /^https:\/\//.test(src));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    image: photos.length ? photos : [fallbackImage],
    url,
    sku: product.slug,
    category,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
      // « Bientôt disponible » ou boutique fermée : pas achetable aujourd'hui.
      availability: `${SCHEMA}${purchasable ? "InStock" : "OutOfStock"}`,
      itemCondition: `${SCHEMA}NewCondition`,
      seller: { "@type": "Organization", name: siteConfig.name },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: shipping.toFixed(2), currency: "EUR" },
        shippingDestination: countries.map((country) => ({ "@type": "DefinedRegion", addressCountry: country })),
      },
      // Droit de rétractation de 14 jours, retour par courrier à la charge du
      // client (conditions générales de vente).
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: [...countries],
        returnPolicyCategory: `${SCHEMA}MerchantReturnFiniteReturnWindow`,
        merchantReturnDays: 14,
        returnMethod: `${SCHEMA}ReturnByMail`,
        returnFees: `${SCHEMA}ReturnFeesCustomerResponsibility`,
      },
    },
  };
}
