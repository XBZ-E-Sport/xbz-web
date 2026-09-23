import { getTranslations } from "next-intl/server";

import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { routing } from "@/i18n/routing";

// Bannière fixe : rien ne dépend de la requête. Le segment `[locale]` empêche
// Next d'inférer le prérendu, on le déclare donc explicitement (une image par
// langue, générée au build). `alt` reste une constante statique (contrainte Next).
export const dynamic = "force-static";

export const alt = "Calendrier & résultats — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  return ogImage({
    eyebrow: t("calendrier.eyebrow"),
    title: t("calendrier.title"),
    subtitle: t("calendrier.subtitle"),
    accent: "#ffd964",
    accentTo: "#dc2515",
  });
}
