import { getTranslations } from "next-intl/server";

import { ogHomeImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { routing } from "@/i18n/routing";

// Bannière affichée lors du partage d'un lien XBZ (Discord, Twitter/X, etc.) :
// la composition du hero (corbeau, XBZ ESPORT, slogan, CTA), aux polices de la
// charte — voir src/lib/og.tsx.
// `alt` doit rester une constante statique (contrainte Next).
// Bannière fixe : rien ne dépend de la requête. Le segment `[locale]` empêche
// Next d'inférer le prérendu, on le déclare donc explicitement (une image par
// langue, générée au build) — comme avant l'i18n.
export const dynamic = "force-static";

export const alt = "XBZ Esport — structure esport compétitive Rocket League";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  const tHome = await getTranslations({ locale, namespace: "home" });

  return ogHomeImage({
    subtitle: t("home.subtitle"),
    slogan: tHome("slogan"),
    cta: t("home.cta"),
  });
}
