import { getTranslations } from "next-intl/server";

import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { routing } from "@/i18n/routing";

// Bannière fixe : rien ne dépend de la requête. `alt` reste une constante
// statique (contrainte Next). Une image par langue, générée au build.
export const dynamic = "force-static";

export const alt = "Conditions générales de vente — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  return ogImage({
    eyebrow: t("cgv.eyebrow"),
    title: t("cgv.title"),
    subtitle: t("cgv.subtitle"),
    accent: "#f4a79b",
    accentTo: "#dc2515",
  });
}
