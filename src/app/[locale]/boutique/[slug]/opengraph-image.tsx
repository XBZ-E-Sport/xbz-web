import { productBanner } from "@/lib/og-banners";
import { dynamicOgRoute } from "@/lib/og-routes";

// Bannière générée à la volée (produit lu en base à chaque partage). Son
// identifiant suit le texte affiché (nom, prix, description) : un prix
// modifié change l'adresse de l'image, les réseaux ne ressortent plus l'ancien.
export const dynamic = "force-dynamic";

const route = dynamicOgRoute<{ locale: string; slug: string }>(({ locale, slug }) => productBanner(locale, slug));
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
