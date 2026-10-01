import { articleBanner } from "@/lib/og-banners";
import { dynamicOgRoute } from "@/lib/og-routes";

// Bannière générée à la volée (article lu en base à chaque partage). Son
// identifiant suit le texte affiché : corriger un titre change l'adresse de
// l'image, et les réseaux ne ressortent plus l'ancienne.
export const dynamic = "force-dynamic";

const route = dynamicOgRoute<{ locale: string; slug: string }>(({ locale, slug }) =>
  articleBanner(locale, slug),
);
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
