// Polices propres à l'accueil et à la page 404, déclarées ICI plutôt que dans
// le layout : une police déclarée par le layout racine est PRÉCHARGÉE sur
// toutes les pages (doc next/font). Oswald et Special Gothic ne servaient
// qu'ici, mais pesaient ~40 Ko sur le chargement de chaque page du site.
//
// Importé par page.tsx (l'accueil) SEULEMENT : la police n'est préchargée que
// sur sa route. Surtout pas par not-found.tsx, qui fait partie de l'arbre de
// toutes les pages (il déclare son propre Oswald, sans préchargement). Sa
// variable CSS se pose sur l'élément qui l'utilise
// (`${fontImpact.variable} font-impact`) — les jetons de thème correspondants
// sont `@theme inline` dans globals.css, résolus sur l'élément.

import { Oswald, Special_Gothic_Expanded_One } from "next/font/google";

// Mots-chocs — Oswald condensé, en 700 seul (le seul poids utilisé : hero
// « XBZ Esport », chiffres de la structure).
export const fontImpact = Oswald({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-impact-family",
  display: "swap",
});

// Slogan — Special Gothic Expanded One (charte). Poids unique 400.
// `adjustFontFallback: false` : next/font n'a pas les métriques de cette police
// récente pour générer un fallback anti-CLS et log un warning à chaque requête.
export const fontSubtitle = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-subtitle-family",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});
