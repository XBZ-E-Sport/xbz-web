import { getTranslations } from "next-intl/server";

import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { routing } from "@/i18n/routing";

// `alt` doit rester une constante statique (contrainte Next) : elle n'est pas
// traduite. Le texte DANS l'image, lui, suit la langue de l'URL partagée.
// Bannière fixe : rien ne dépend de la requête. Le segment `[locale]` empêche
// Next d'inférer le prérendu, on le déclare donc explicitement (une image par
// langue, générée au build) — comme avant l'i18n.
export const dynamic = "force-static";

export const alt = "Le club — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  return ogImage({
    eyebrow: t("leClub.eyebrow"),
    title: t("leClub.title"),
    subtitle: t("leClub.subtitle"),
  });
}
