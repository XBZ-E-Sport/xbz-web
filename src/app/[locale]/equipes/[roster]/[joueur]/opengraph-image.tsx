import { memberBanner } from "@/lib/og-banners";
import { dynamicOgRoute } from "@/lib/og-routes";

// Joueur de roster ou membre de pôle (résolu dans memberBanner).
export const dynamic = "force-dynamic";

const route = dynamicOgRoute<{ locale: string; roster: string; joueur: string }>(
  ({ locale, roster, joueur }) => memberBanner(locale, roster, joueur),
);
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
