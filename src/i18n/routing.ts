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
/**
 * Cookie qui mémorise la langue choisie.
 *
 * Sorti de la config parce que deux endroits en dépendent HORS de next-intl :
 * l'action de connexion Discord l'écrit, et `/auth/callback` le relit — cette
 * route vit hors du segment `[locale]`, elle n'a aucun autre indice de langue.
 *
 * `sameSite: "lax"` n'est pas un détail de confort : le retour d'OAuth est une
 * navigation de premier niveau venue d'un autre domaine (Supabase → notre
 * callback). En « lax » le cookie part avec la requête ; en « strict » il
 * resterait à quai et un staff anglophone reviendrait toujours en français.
 */
export const LOCALE_COOKIE = {
  name: "XBZ_LOCALE",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  path: "/",
} as const;

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  // Mémorise la langue choisie via le sélecteur (cookie posé par next-intl).
  localeCookie: LOCALE_COOKIE,
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
