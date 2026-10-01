import { getTranslations } from "next-intl/server";

import { ogHomeImage } from "@/lib/og";
import { OG_DEPLOY_VERSION, ogImageMetadata, withLocale } from "@/lib/og-routes";
import { siteConfig } from "@/lib/site";

// Bannière affichée lors du partage d'un lien XBZ (Discord, Twitter/X, etc.) :
// la composition du hero (corbeau, XBZ ESPORT, slogan, CTA), aux polices de la
// charte — voir src/lib/og.tsx. Identifiant versionné et texte alternatif
// traduit : voir src/lib/og-routes.ts.
// Bannière fixe : rien ne dépend de la requête. Rendue à la première demande
// dans chaque langue, puis servie depuis le cache jusqu'au déploiement suivant
// (`force-static` : le segment `[locale]` empêche Next de l'inférer).
export const dynamic = "force-static";

type Props = { params: Promise<{ locale: string }> | { locale: string } };

export async function generateImageMetadata({ params }: Props) {
  // Appel du build, sans langue : rien à prégénérer (voir withLocale).
  const resolved = await withLocale(params);
  if (!resolved) return [];
  const t = await getTranslations({ locale: resolved.locale, namespace: "og" });
  return ogImageMetadata(OG_DEPLOY_VERSION, `${siteConfig.name} — ${t("home.subtitle")}`);
}

export default async function OpengraphImage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  const tHome = await getTranslations({ locale, namespace: "home" });

  return ogHomeImage({
    subtitle: t("home.subtitle"),
    slogan: tHome("slogan"),
    cta: t("home.cta"),
  });
}
