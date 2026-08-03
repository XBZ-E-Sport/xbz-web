import { defineRouting } from "next-intl/routing";

/**
 * Routage bilingue.
 *
 * `localePrefix: "always"` : chaque page porte sa langue dans l'URL —
 * `/fr/equipes` et `/en/equipes`. Les deux langues sont traitées à égalité,
 * l'URL dit toujours ce qu'on regarde, et rien n'est ambigu au partage.
 *
 * Conséquence : les anciennes URL sans préfixe (`/equipes`) n'existent plus
 * telles quelles. `src/proxy.ts` les redirige en 308 (permanent) vers
 * `/fr/…` — les liens déjà partagés continuent de marcher et Google
 * transfère le référencement acquis vers la nouvelle adresse.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  // Mémorise la langue choisie via le sélecteur (cookie posé par next-intl).
  localeCookie: { name: "XBZ_LOCALE", maxAge: 60 * 60 * 24 * 365 },
  // On ne devine la langue ni depuis Accept-Language, ni depuis le cookie :
  // une URL nue (`/equipes`) part TOUJOURS vers `/fr/equipes`. Une redirection
  // permanente qui varierait selon le visiteur serait incachable par le CDN, et
  // Google recevrait tantôt le français tantôt l'anglais sur la même adresse.
  // La langue se choisit par l'URL ou par le sélecteur, jamais par devinette.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** Étiquettes du sélecteur de langue. */
export const localeLabels: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};
