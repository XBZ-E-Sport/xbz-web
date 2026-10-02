// Messages envoyés au NAVIGATEUR : seulement ceux des composants client.
//
// Tout le catalogue (41 namespaces, ~35 Ko) partait dans chaque page pour
// hydrater une poignée de composants : environ la moitié du HTML compressé.
// Les composants serveur, eux, lisent les messages côté serveur et n'envoient
// que le texte rendu — ils n'ont rien à faire ici.
//
// Chaque composant client déclare ci-dessous les namespaces qu'il lit avec
// `useTranslations` ; le layout fournit ceux de la coquille, chaque page ceux
// de ses propres composants (<ClientMessages>). `client-messages.test.ts`
// vérifie que la liste suit le code : un namespace oublié ferait afficher la
// clé brute au lieu du texte.

import type { AbstractIntlMessages } from "next-intl";

export const CLIENT_NAMESPACES = {
  Header: ["nav"],
  // Pastille du panier, dans l'en-tête.
  CartLink: ["nav"],
  LanguageSwitcher: ["language"],
  // src/app/[locale]/error.tsx (écran d'erreur, rendu dans le layout).
  ErrorPage: ["error", "common", "notFound"],
  ActualiteList: ["actualite", "articleCategories"],
  BoutiqueList: ["boutique", "productCategories"],
  // Taille + ajout au panier : cartes de la boutique ET page produit.
  BuyBox: ["boutique"],
  ProductGallery: ["product"],
  CartView: ["cart"],
  MediaGallery: ["galerie", "mediaCategories"],
  RecrutementForm: ["recrutementForm", "formErrors", "fieldLabels", "recrutementCategories", "playerRoles"],
  SupportForm: ["supportForm", "formErrors", "fieldLabels", "supportSubjects"],
} as const satisfies Record<string, readonly string[]>;

export type ClientComponent = keyof typeof CLIENT_NAMESPACES;

/** Composants client de la coquille, présents sur toutes les pages (layout). */
export const LAYOUT_CLIENTS = [
  "Header",
  "CartLink",
  "LanguageSwitcher",
  "ErrorPage",
] as const satisfies readonly ClientComponent[];

/** Sous-catalogue des namespaces lus par `clients`. */
export function pickMessages(
  messages: AbstractIntlMessages,
  clients: readonly ClientComponent[],
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const client of clients) {
    for (const ns of CLIENT_NAMESPACES[client]) {
      if (ns in messages) picked[ns] = messages[ns];
    }
  }
  return picked;
}
