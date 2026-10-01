// Fabrique de bannières Open Graph (1200×630) partagée par tout le site, aux
// couleurs ET aux polices de la charte : toutes les cartes de partage (accueil,
// pages, article, équipe, joueur) forment une seule famille visuelle, la même
// que le site.
//
// Hiérarchie typographique du site, reprise telle quelle :
//   - titres        → Bruno Ace SC (comme les H1 des pages)
//   - sur-titres    → Special Gothic Expanded One (comme « FROM ZERO TO LEGEND »)
//   - mots-chocs    → Oswald 700 (comme « XBZ ESPORT » du hero)
//   - texte courant → Sarabun
//
// Polices : fichiers TTF dans src/assets/og/ (licence OFL jointe), réduits au
// latin (accents français, Œ, « », ’, €…). `next/og` ne lit ni le WOFF2 ni les
// polices de next/font : il lui faut les fichiers eux-mêmes.
//
// ⚠️ `next/og` (satori) ne supporte que flexbox + un sous-ensemble de CSS :
//    - tout élément à plusieurs enfants DOIT porter `display: "flex"` ;
//    - pas de `grid`. Voir node_modules/next/dist/docs/.../image-response.md.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";
import { clamp } from "@/lib/text";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const RED = "#dc2515";
const YELLOW = "#fccd05";
const WHITE = "#f2f3f4";
const SUBTITLE_COLOR = "#b3aca7";
const FOOTER_COLOR = "#8a837d";

// Fond du site : projecteur rouge haut-gauche, spark jaune bas-droite, trame
// hairline en « / », lavis charbon.
const BACKGROUND = [
  "radial-gradient(circle at 6% 0%, rgba(220, 37, 21, 0.34), transparent 55%)",
  "radial-gradient(circle at 100% 100%, rgba(252, 205, 5, 0.08), transparent 42%)",
  "repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.03) 0px, rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 17px)",
  "linear-gradient(160deg, #18161b 0%, #100e13 55%, #08070a 100%)",
].join(", ");

// Halo rouge derrière le corbeau (même recette que le hero).
const RAVEN_HALO =
  "radial-gradient(circle, rgba(220, 37, 21, 0.55), rgba(220, 37, 21, 0.24) 30%, rgba(220, 37, 21, 0.07) 55%, transparent 72%)";

// ---------------------------------------------------------------------------
//  Assets (polices + images), lus une seule fois par processus.
//  Chemins littéraux et explicites : le traçage des fichiers du build (Vercel)
//  embarque ainsi les assets dans les fonctions des bannières dynamiques.
// ---------------------------------------------------------------------------

type OgAssets = {
  fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[];
  logo: string;
  raven: string;
};

let assetsPromise: Promise<OgAssets> | null = null;

async function loadAssets(): Promise<OgAssets> {
  const root = process.cwd();
  const [bruno, gothic, oswald, sarabun, sarabunSemi, logo, raven] = await Promise.all([
    readFile(join(root, "src/assets/og/BrunoAceSC-Regular.ttf")),
    readFile(join(root, "src/assets/og/SpecialGothicExpandedOne-Regular.ttf")),
    readFile(join(root, "src/assets/og/Oswald-Bold.ttf")),
    readFile(join(root, "src/assets/og/Sarabun-Regular.ttf")),
    readFile(join(root, "src/assets/og/Sarabun-SemiBold.ttf")),
    readFile(join(root, "public/logo-xbz-wide.png")),
    readFile(join(root, "public/corbeau.png")),
  ]);
  return {
    fonts: [
      { name: "Bruno Ace SC", data: bruno, weight: 400, style: "normal" },
      { name: "Special Gothic", data: gothic, weight: 400, style: "normal" },
      { name: "Oswald", data: oswald, weight: 700, style: "normal" },
      { name: "Sarabun", data: sarabun, weight: 400, style: "normal" },
      { name: "Sarabun", data: sarabunSemi, weight: 600, style: "normal" },
    ],
    logo: `data:image/png;base64,${logo.toString("base64")}`,
    raven: `data:image/png;base64,${raven.toString("base64")}`,
  };
}

function ogAssets(): Promise<OgAssets> {
  // En cas d'échec (fichier manquant), on ne garde pas la promesse rejetée :
  // la requête suivante retentera.
  assetsPromise ??= loadAssets().catch((error: unknown) => {
    assetsPromise = null;
    throw error;
  });
  return assetsPromise;
}

// ---------------------------------------------------------------------------

/** Domaine affiché en pied de bannière (sans protocole). */
function siteHost(): string {
  try {
    return new URL(siteConfig.url).host;
  } catch {
    return "xbz-esport.org";
  }
}

// Coupe propre des textes trop longs : partagée avec les métadonnées (src/lib/text.ts).
export { clamp };

/** Taille du titre (Bruno Ace SC est large) adaptée à sa longueur. */
function titleSize(length: number): number {
  if (length <= 12) return 76;
  if (length <= 20) return 62;
  if (length <= 32) return 50;
  if (length <= 50) return 42;
  return 36;
}

/** Corbeau + halo, emblème de la marque. */
function Raven({ src, width }: { src: string; width: number }) {
  const height = Math.round((width * 374) / 573);
  const halo = Math.round(width * 1.1);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: halo, height: halo }}>
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: halo,
          height: halo,
          borderRadius: "50%",
          backgroundImage: RAVEN_HALO,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu satori, pas du DOM */}
      <img src={src} width={width} height={height} alt="" />
    </div>
  );
}

/**
 * Bande en biais du pied (même grammaire que les bandes de section du site) :
 * bord haut qui monte vers la droite, liseré rouge et court éclat jaune.
 * Tout en pixels : satori résout mal les pourcentages des éléments positionnés.
 */
const BAND_HEIGHT = 118;
const BAND_SLOPE = 26;

function FooterBand({ children }: { children: React.ReactNode }) {
  const w = OG_SIZE.width;
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: 0,
        top: OG_SIZE.height - BAND_HEIGHT,
        width: w,
        height: BAND_HEIGHT,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: BAND_HEIGHT,
          backgroundImage:
            "linear-gradient(100deg, rgba(46, 44, 45, 0.35), rgba(46, 44, 45, 0.6) 50%, rgba(46, 44, 45, 0.35))",
          clipPath: `polygon(0px ${BAND_SLOPE}px, ${w}px 0px, ${w}px ${BAND_HEIGHT}px, 0px ${BAND_HEIGHT}px)`,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: BAND_SLOPE + 3,
          backgroundImage: `linear-gradient(90deg, transparent 2%, ${RED} 26%, ${RED} 72%, ${YELLOW} 72%, ${YELLOW} 76%, ${RED} 76%, transparent 98%)`,
          clipPath: `polygon(0px ${BAND_SLOPE}px, ${w}px 0px, ${w}px 2.5px, 0px ${BAND_SLOPE + 2.5}px)`,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 72,
          top: BAND_SLOPE + 22,
          width: w - 144,
          height: 50,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Couleurs de sur-titre : celles de la charte, et rien d'autre (plus de hex
// libre par page, qui faisait réapparaître violet, doré, gris...).
const EYEBROW_TONES = { yellow: YELLOW, red: RED } as const;
export type OgTone = keyof typeof EYEBROW_TONES;

export type OgFrameOptions = {
  /** Sur-titre (rôle, catégorie, type de pôle...). */
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  /** Couleur du sur-titre : jaune par défaut (comme les sur-titres du site), rouge pour les catégories d'article rouges (articleCategoryTone). */
  tone?: OgTone;
};

/** Construit une bannière OG XBZ (pages, article, équipe, joueur). */
export async function ogImage({ eyebrow, title, subtitle, tone = "yellow" }: OgFrameOptions): Promise<ImageResponse> {
  const { fonts, logo, raven } = await ogAssets();
  const safeTitle = clamp(title, 80);
  // Plus le titre prend de lignes, moins le sous-titre en a : le tout doit
  // tenir au-dessus de la bande du pied.
  const subtitleMax = safeTitle.length <= 32 ? 120 : safeTitle.length <= 50 ? 90 : 70;
  const safeSubtitle = subtitle ? clamp(subtitle, subtitleMax) : null;
  const safeEyebrow = eyebrow ? clamp(eyebrow, 40) : null;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          color: WHITE,
          backgroundColor: "#0b0a0c",
          backgroundImage: BACKGROUND,
          fontFamily: "Sarabun",
        }}
      >
        {/* Emblème, à droite */}
        <div style={{ display: "flex", position: "absolute", right: -70, top: 36 }}>
          <Raven src={raven} width={500} />
        </div>

        {/* Contenu */}
        <div style={{ display: "flex", flexDirection: "column", padding: "60px 72px 0", width: 760 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendu satori, pas du DOM */}
          <img src={logo} width={188} height={50} alt="" />
          <div style={{ display: "flex", flexDirection: "column", marginTop: 70 }}>
            {safeEyebrow ? (
              <div
                style={{
                  display: "flex",
                  fontFamily: "Special Gothic",
                  fontSize: 24,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: EYEBROW_TONES[tone],
                }}
              >
                {safeEyebrow}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontFamily: "Bruno Ace SC",
                fontSize: titleSize(safeTitle.length),
                lineHeight: 1.12,
              }}
            >
              {safeTitle}
            </div>
            {safeSubtitle ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 22,
                  fontSize: 27,
                  lineHeight: 1.4,
                  color: SUBTITLE_COLOR,
                  maxWidth: 640,
                }}
              >
                {safeSubtitle}
              </div>
            ) : null}
          </div>
        </div>

        <FooterBand>
          <div style={{ display: "flex", fontFamily: "Special Gothic", fontSize: 18, letterSpacing: "0.3em", color: SUBTITLE_COLOR }}>
            FROM ZERO TO LEGEND
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 600, letterSpacing: "0.06em", color: FOOTER_COLOR }}>
            {siteHost()}
          </div>
        </FooterBand>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

export type OgHomeOptions = {
  /** Accroche (« Structure esport compétitive · Rocket League »). */
  subtitle: string;
  /** Slogan (« From Zero To Legend »). */
  slogan: string;
  /** Appel à l'action (« Nous rejoindre »). */
  cta: string;
};

// Bouton de la bannière d'accueil (taille fixe : le coin coupé est en pixels).
const CTA = { width: 300, height: 62, cut: 16 };

/** Bannière de l'accueil : la composition du hero (corbeau, XBZ ESPORT, slogan, CTA). */
export async function ogHomeImage({ subtitle, slogan, cta }: OgHomeOptions): Promise<ImageResponse> {
  const { fonts, raven } = await ogAssets();

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
          color: WHITE,
          backgroundColor: "#0b0a0c",
          backgroundImage: BACKGROUND,
          fontFamily: "Sarabun",
          textAlign: "center",
        }}
      >
        <Raven src={raven} width={230} />
        <div
          style={{
            display: "flex",
            marginTop: -44,
            fontFamily: "Oswald",
            fontWeight: 700,
            fontSize: 122,
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          XBZ ESPORT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontFamily: "Special Gothic",
            fontSize: 30,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "transparent",
            backgroundImage: `linear-gradient(90deg, ${RED}, ${YELLOW} 50%, ${RED})`,
            backgroundClip: "text",
          }}
        >
          {slogan}
        </div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: SUBTITLE_COLOR }}>{subtitle}</div>
        {/* CTA aux coins coupés, comme le bouton principal du site (.cut). */}
        <div
          style={{
            display: "flex",
            marginTop: 30,
            width: CTA.width,
            height: CTA.height,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 600,
            color: "white",
            backgroundColor: RED,
            clipPath: `polygon(0px 0px, ${CTA.width}px 0px, ${CTA.width}px ${CTA.height - CTA.cut}px, ${CTA.width - CTA.cut}px ${CTA.height}px, 0px ${CTA.height}px)`,
          }}
        >
          {cta}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
