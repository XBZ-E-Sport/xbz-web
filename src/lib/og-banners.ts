// Contenu des bannières Open Graph tirées de la base (article, équipe, membre,
// offre) : CE QUI EST AFFICHÉ, calculé à un seul endroit.
//
// La route d'image s'en sert pour dessiner la bannière, `generateImageMetadata`
// pour en dériver l'identifiant (qui change dès qu'un texte affiché change),
// et une page pour connaître l'adresse de sa bannière (JSON-LD). Pas de rendu
// ici : importable par les pages sans tirer le moteur d'images.

import { getTranslations } from "next-intl/server";

import { getArticleBySlug } from "@/lib/actualite";
import { getProductBySlug } from "@/lib/boutique";
import { getPoleBySlug } from "@/lib/equipes";
import { articleCategoryTone } from "@/lib/format";
import { formatEuros } from "@/lib/money";
import { getOfferBySlug } from "@/lib/offres";
import { getPlayer, getRosterBySlug, type Player } from "@/lib/roster";
import { ogAlt as alt, type Banner } from "@/lib/og-version";

export { bannerVersion, type Banner } from "@/lib/og-version";

/** Bannière d'un article. */
export async function articleBanner(locale: string, slug: string): Promise<Banner> {
  const t = await getTranslations({ locale, namespace: "og" });
  const article = await getArticleBySlug(slug, locale);
  if (!article) {
    return { frame: { eyebrow: t("actualite.eyebrow"), title: t("articleNotFound") }, alt: alt(t("articleNotFound")) };
  }
  const tCat = await getTranslations({ locale, namespace: "articleCategories" });
  return {
    frame: {
      eyebrow: tCat(article.category),
      title: article.title,
      subtitle: article.excerpt,
      // Même teinte que le badge de l'article sur le site (le neutre passe en jaune).
      tone: articleCategoryTone[article.category] === "red" ? "red" : "yellow",
    },
    alt: alt(article.title),
  };
}

/** Bannière d'un roster ou d'un pôle (le segment [roster] résout d'abord un roster). */
export async function equipeBanner(locale: string, slug: string): Promise<Banner> {
  const t = await getTranslations({ locale, namespace: "og" });
  const tDetail = await getTranslations({ locale, namespace: "equipeDetail" });

  const roster = await getRosterBySlug(slug, locale);
  if (roster) {
    return {
      frame: {
        eyebrow: roster.rank ?? t("roster"),
        title: roster.name,
        subtitle: roster.description ?? tDetail("metaRoster", { name: roster.name }),
      },
      alt: alt(roster.name),
    };
  }

  const pole = await getPoleBySlug(slug, locale);
  if (pole) {
    return {
      frame: {
        eyebrow: pole.category === "esport" ? tDetail("poleEsport") : tDetail("poleStaff"),
        title: pole.name,
        subtitle: pole.description ?? tDetail("metaPole", { name: pole.name }),
      },
      alt: alt(pole.name),
    };
  }

  const tNotFound = await getTranslations({ locale, namespace: "notFound" });
  return { frame: { eyebrow: t("equipes.eyebrow"), title: tNotFound("title") }, alt: alt(tNotFound("title")) };
}

// Résout un membre : d'abord un joueur de roster, sinon un membre de pôle.
async function resolveMember(
  parentSlug: string,
  memberSlug: string,
  locale: string,
): Promise<{ player: Player; parentName: string; isPole: boolean } | null> {
  const res = await getPlayer(parentSlug, memberSlug, locale);
  if (res) return { player: res.player, parentName: res.roster.name, isPole: false };

  const pole = await getPoleBySlug(parentSlug, locale);
  const member = pole?.members.find((m) => m.slug === memberSlug);
  if (pole && member) return { player: member, parentName: pole.name, isPole: true };

  return null;
}

/** Bannière d'un membre (joueur de roster ou membre de pôle). */
export async function memberBanner(locale: string, parentSlug: string, memberSlug: string): Promise<Banner> {
  const t = await getTranslations({ locale, namespace: "og" });
  const res = await resolveMember(parentSlug, memberSlug, locale);
  if (!res) {
    return { frame: { eyebrow: t("member"), title: t("memberNotFound") }, alt: alt(t("memberNotFound")) };
  }

  const tJoueur = await getTranslations({ locale, namespace: "joueur" });
  const tRole = await getTranslations({ locale, namespace: "playerRoles" });
  const { player, parentName, isPole } = res;
  // Pour un pôle, le pôle EST le rôle (pas de sous-rôle).
  const role = tRole.has(player.role) ? tRole(player.role) : player.role;
  const subtitle =
    [player.nom, player.rang ? `${tJoueur("rank")} ${player.rang}` : null, player.pays]
      .filter(Boolean)
      .join("  ·  ") || null;

  return {
    frame: { eyebrow: isPole ? parentName : `${role} · ${parentName}`, title: player.pseudo, subtitle },
    alt: alt(player.pseudo),
  };
}

/** Bannière d'une offre d'emploi. */
export async function offerBanner(locale: string, slug: string): Promise<Banner> {
  const t = await getTranslations({ locale, namespace: "og" });
  const offer = await getOfferBySlug(slug, locale);
  if (!offer) {
    const tNotFound = await getTranslations({ locale, namespace: "notFound" });
    return { frame: { eyebrow: t("carrieres.eyebrow"), title: tNotFound("title") }, alt: alt(tNotFound("title")) };
  }
  return {
    frame: { eyebrow: offer.department || t("carrieres.eyebrow"), title: offer.title, subtitle: offer.excerpt || null },
    alt: alt(offer.title),
  };
}

/** Bannière d'un produit : catégorie, nom, prix et début de description. */
export async function productBanner(locale: string, slug: string): Promise<Banner> {
  const t = await getTranslations({ locale, namespace: "og" });
  const product = await getProductBySlug(slug, locale);
  if (!product) {
    const tNotFound = await getTranslations({ locale, namespace: "notFound" });
    return { frame: { eyebrow: t("boutique.eyebrow"), title: tNotFound("title") }, alt: alt(tNotFound("title")) };
  }
  const tCat = await getTranslations({ locale, namespace: "productCategories" });
  return {
    frame: {
      eyebrow: tCat(product.category),
      title: product.name,
      subtitle: [formatEuros(product.price, locale), product.description].filter(Boolean).join("  ·  "),
    },
    alt: alt(product.name),
  };
}
