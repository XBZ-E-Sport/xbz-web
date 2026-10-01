import { equipeBanner } from "@/lib/og-banners";
import { dynamicOgRoute } from "@/lib/og-routes";

// Le segment [roster] résout d'abord un roster, puis un pôle (URL à plat).
export const dynamic = "force-dynamic";

const route = dynamicOgRoute<{ locale: string; roster: string }>(({ locale, roster }) =>
  equipeBanner(locale, roster),
);
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
