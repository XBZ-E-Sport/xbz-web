import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type PageProps = { params: Promise<{ locale: string }> };

/**
 * Titre de l'onglet et `noindex`.
 *
 * Le `generateMetadata` de `not-found.tsx` arrive trop tard : quand `notFound()`
 * est levé, l'en-tête HTML est déjà parti. Celui de la route, lui, est résolu
 * avant le rendu — c'est le dernier endroit d'où l'on peut encore nommer
 * l'onglet et interdire l'indexation.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notFound" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}

/**
 * Attrape-tout : rend NOTRE page 404 sur les URL qui ne mènent nulle part.
 *
 * Sans ce fichier, `[locale]/not-found.tsx` ne sert jamais aux visiteurs. Next
 * réserve la gestion des URL inconnues au `not-found` RACINE ; celui d'un
 * segment ne se déclenche que sur un `notFound()` appelé depuis ce segment
 * (article au slug inexistant, par exemple). Or notre racine EST un segment
 * dynamique (`[locale]`) depuis le passage en bilingue : plus de `not-found`
 * racine possible, donc plus de 404 maison — Next servait la sienne, en
 * anglais et sans la charte du site.
 *
 * Le remède tient en une route : elle ne correspond qu'aux URL qu'aucune vraie
 * page ne réclame, et déclenche `notFound()` DEPUIS le segment de langue. La
 * 404 remonte alors avec l'en-tête, le pied de page et les traductions.
 *
 * ⚠️ La réponse porte un statut HTTP 200, pas 404 : le rendu est diffusé en
 * flux, et le statut est figé dès le premier octet envoyé. C'est documenté et
 * assumé par Next, qui injecte alors `<meta name="robots" content="noindex">`
 * — c'est cette balise qui empêche Google d'indexer l'URL, pas le statut.
 */
export default async function CatchAllPage({ params }: PageProps) {
  const { locale } = await params;
  // La page 404 ne reçoit aucune prop (contrainte de Next) : elle lira la
  // langue dans le contexte de requête, qu'on renseigne ici.
  setRequestLocale(locale);

  notFound();
}
