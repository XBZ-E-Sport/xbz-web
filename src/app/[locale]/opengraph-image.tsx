import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

// Bannière affichée lors du partage d'un lien XBZ (Discord, Twitter/X, etc.).
// `alt` doit rester une constante statique (contrainte Next).
// Bannière fixe : rien ne dépend de la requête. Le segment `[locale]` empêche
// Next d'inférer le prérendu, on le déclare donc explicitement (une image par
// langue, générée au build) — comme avant l'i18n.
export const dynamic = "force-static";

export const alt = "XBZ Esport — structure esport compétitive Rocket League";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px",
          color: "white",
          background: "linear-gradient(135deg, #070710 0%, #0b1b2e 55%, #06121f 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 150,
            fontWeight: 900,
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          XBZ ESPORT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 42,
            color: "#8fb8d6",
          }}
        >
          {t("home.subtitle")}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 30,
            fontWeight: 700,
            color: "#04141f",
            background: "linear-gradient(90deg, #00bfff, #0066ff)",
            padding: "14px 36px",
            borderRadius: 999,
          }}
        >
          {t("home.cta")}
        </div>
      </div>
    ),
    { ...size },
  );
}
