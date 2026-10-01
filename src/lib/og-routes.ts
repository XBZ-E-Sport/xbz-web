// Routes d'images Open Graph : identifiant VERSIONNÉ et texte alternatif traduit.
//
// Pourquoi versionner : l'adresse d'une image générée par `opengraph-image`
// ne changeait jamais — son `?<hash>` est calculé à partir du FICHIER de la
// route, pas de l'image rendue. Discord, X ou Facebook gardaient donc
// l'ancienne bannière après une refonte ou une correction de titre.
// Avec `generateImageMetadata`, l'identifiant fait partie de l'adresse
// (`…/opengraph-image/<id>`) : il change à chaque déploiement et, pour les
// bannières tirées de la base, dès que le contenu affiché change.

import { getTranslations } from "next-intl/server";

import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { OG_DEPLOY_VERSION, ogAlt, bannerVersion, type Banner } from "@/lib/og-version";

export { OG_DEPLOY_VERSION, ogAlt } from "@/lib/og-version";

/** Métadonnées d'UNE image : identifiant, texte alternatif, format. */
export function ogImageMetadata(id: string, alt: string) {
  return [{ id, alt, size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

/** Pages fixes dont la bannière se lit dans `messages/*.json` → `og.<clé>`. */
export type OgPageKey =
  | "leClub"
  | "presentation"
  | "equipes"
  | "actualite"
  | "boutique"
  | "recrutement"
  | "support"
  | "legal"
  | "privacy"
  | "partenaires"
  | "calendrier"
  | "galerie"
  | "cgv"
  | "carrieres";

type LocaleParams = { params: Promise<{ locale: string }> | { locale: string } };

/**
 * Paramètres reçus par `generateImageMetadata`, ou `null` lors de son appel
 * au build.
 *
 * Next l'appelle à deux moments : pour les métadonnées d'une page (avec tous
 * ses paramètres), et au build pour prégénérer les images. Ce second appel
 * arrive SANS la langue : une route d'image n'a pas de segment parent qui la
 * fournirait (cf. `collectAppRouteSegments`), et sans langue next-intl irait
 * la chercher dans les en-têtes de la requête — qui n'existe pas au build.
 * On ne prégénère donc rien : chaque bannière est rendue à sa première
 * demande (puis servie depuis le cache pour une page fixe, `force-static`).
 */
export async function withLocale<P extends { locale: string }>(params: Promise<P> | P | undefined): Promise<P | null> {
  const resolved = await params;
  return resolved?.locale ? resolved : null;
}

/**
 * Route d'image d'une page fixe : `generateImageMetadata` (identifiant
 * versionné, alt dans la langue de la page) et rendu de la bannière.
 */
export function pageOgRoute(key: OgPageKey) {
  return {
    async generateImageMetadata({ params }: LocaleParams) {
      const resolved = await withLocale(params);
      if (!resolved) return [];
      const t = await getTranslations({ locale: resolved.locale, namespace: "og" });
      return ogImageMetadata(OG_DEPLOY_VERSION, ogAlt(t(`${key}.title`)));
    },
    async Image({ params }: LocaleParams) {
      const { locale } = await params;
      const t = await getTranslations({ locale, namespace: "og" });
      return ogImage({
        eyebrow: t(`${key}.eyebrow`),
        title: t(`${key}.title`),
        subtitle: t(`${key}.subtitle`),
      });
    },
  };
}

/**
 * Route d'image d'une page tirée de la base (article, équipe, membre, offre) :
 * `banner` lit le contenu une fois par appel ; l'identifiant en dérive, donc
 * une bannière dont le texte change obtient une nouvelle adresse.
 *
 * Une ancienne adresse (texte modifié depuis) répond 404 : les réseaux
 * relisent la page, y trouvent la nouvelle et l'affichent.
 */
export function dynamicOgRoute<P extends { locale: string }>(banner: (params: P) => Promise<Banner>) {
  return {
    async generateImageMetadata({ params }: { params: Promise<P> | P }) {
      const resolved = await withLocale(params);
      if (!resolved) return [];
      const b = await banner(resolved);
      return ogImageMetadata(bannerVersion(b), b.alt);
    },
    async Image({ params }: { params: Promise<P> }) {
      return ogImage((await banner(await params)).frame);
    },
  };
}
