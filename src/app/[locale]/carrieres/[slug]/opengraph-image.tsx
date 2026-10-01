import { offerBanner } from "@/lib/og-banners";
import { dynamicOgRoute } from "@/lib/og-routes";

// Une offre partagée affichait la bannière générique du site : la sienne porte
// désormais son intitulé, son service et son résumé.
export const dynamic = "force-dynamic";

const route = dynamicOgRoute<{ locale: string; slug: string }>(({ locale, slug }) =>
  offerBanner(locale, slug),
);
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
