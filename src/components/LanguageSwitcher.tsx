"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
// Import drapeau par drapeau : `import * as Flags` embarquerait les ~250 SVG du
// paquet dans le bundle client (ce composant est monté sur toutes les pages).
import FR from "country-flag-icons/react/3x2/FR";
import GB from "country-flag-icons/react/3x2/GB";

import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";

/**
 * Drapeau par langue.
 *
 * Un drapeau désigne un pays, pas une langue : l'anglais n'en a pas. On prend
 * le Royaume-Uni, convention des sites européens — les États-Unis (`US`)
 * conviendraient tout aussi bien, c'est le seul endroit à changer.
 */
const FLAGS: Record<Locale, typeof FR> = { fr: FR, en: GB };

/**
 * Bascule FR ⇄ EN.
 *
 * `usePathname()` de next-intl renvoie le chemin SANS préfixe de langue : on
 * peut donc rejouer la même page dans l'autre langue sans reconstruire l'URL à
 * la main. Le choix est mémorisé par le cookie déclaré dans `routing`.
 *
 * Le bouton affiche le drapeau de la langue VERS laquelle on va, pas celui de
 * la langue courante. Un drapeau seul ne dit pas dans quel sens il agit :
 * `aria-label` et `title` portent la phrase complète, pour le lecteur d'écran
 * comme au survol.
 */
export default function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;
  const OtherFlag = FLAGS[other];
  const label = t("switchTo", { language: localeLabels[other] });

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          router.replace(pathname, { locale: other });
        })
      }
      title={label}
      aria-label={label}
      className="rounded-lg p-2 transition hover:bg-white/10 hover:cursor-pointer disabled:opacity-50"
    >
      {/* Le liseré clair détache le blanc des deux drapeaux du fond sombre. */}
      <OtherFlag
        aria-hidden="true"
        className="h-4 w-6 rounded-xs shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
      />
    </button>
  );
}
