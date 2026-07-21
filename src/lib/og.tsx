// Fabrique de bannières Open Graph (1200×630) partagée par tout le site.
// Reprend l'identité de la bannière racine (src/app/opengraph-image.tsx) pour
// que toutes les cartes de partage (accueil, article, équipe, joueur) forment
// une seule famille visuelle.
//
// ⚠️ `next/og` (satori) ne supporte que flexbox + un sous-ensemble de CSS :
//    - tout élément à plusieurs enfants DOIT porter `display: "flex"` ;
//    - pas de `grid`. Voir node_modules/next/dist/docs/.../image-response.md.

import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "linear-gradient(135deg, #070710 0%, #0b1b2e 55%, #06121f 100%)";
const SUBTITLE_COLOR = "#8fb8d6";
const FOOTER_COLOR = "#5f7d95";

/** Domaine affiché en pied de bannière (sans protocole). */
function siteHost(): string {
  try {
    return new URL(siteConfig.url).host;
  } catch {
    return "xbz-esport.fr";
  }
}

/** Coupe proprement un texte trop long (les titres/descriptions viennent de la BDD). */
function clamp(value: string, max: number): string {
  const t = value.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Taille du titre adaptée à sa longueur pour éviter tout débordement. */
function titleSize(length: number): number {
  if (length <= 22) return 88;
  if (length <= 38) return 70;
  if (length <= 58) return 54;
  return 44;
}

export type OgFrameOptions = {
  /** Sur-titre (rôle, catégorie, type de pôle...). */
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  /** Couleur d'accent (sur-titre + départ des dégradés). */
  accent?: string;
  /** Fin du dégradé d'accent (carré de marque + barre de pied). */
  accentTo?: string;
};

/** Construit une bannière OG XBZ cohérente et la renvoie en `ImageResponse`. */
export function ogImage({
  eyebrow,
  title,
  subtitle,
  accent = "#00bfff",
  accentTo = "#0066ff",
}: OgFrameOptions): ImageResponse {
  const safeTitle = clamp(title, 80);
  const safeSubtitle = subtitle ? clamp(subtitle, 120) : null;
  const safeEyebrow = eyebrow ? clamp(eyebrow, 48) : null;
  const accentGradient = `linear-gradient(90deg, ${accent}, ${accentTo})`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "white",
          background: BG,
          fontFamily: "sans-serif",
        }}
      >
        {/* Marque */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              width: 46,
              height: 46,
              borderRadius: 12,
              background: accentGradient,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: "0.12em",
            }}
          >
            XBZ ESPORT
          </div>
        </div>

        {/* Contenu */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {safeEyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: accent,
              }}
            >
              {safeEyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: titleSize(safeTitle.length),
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            {safeTitle}
          </div>
          {safeSubtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 30,
                lineHeight: 1.35,
                color: SUBTITLE_COLOR,
              }}
            >
              {safeSubtitle}
            </div>
          ) : null}
        </div>

        {/* Pied */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 6,
              borderRadius: 999,
              background: accentGradient,
            }}
          />
          <div style={{ display: "flex", fontSize: 24, color: FOOTER_COLOR }}>
            {siteHost()}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
