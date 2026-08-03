"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";

/**
 * Bascule FR ⇄ EN.
 *
 * `usePathname()` de next-intl renvoie le chemin SANS préfixe de langue : on
 * peut donc rejouer la même page dans l'autre langue sans reconstruire l'URL à
 * la main. Le choix est mémorisé par le cookie déclaré dans `routing`.
 */
export default function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          router.replace(pathname, { locale: other });
        })
      }
      // `title` + `aria-label` portent la phrase complète : les deux lettres
      // affichées ne suffisent pas à un lecteur d'écran.
      title={t("switchTo", { language: localeLabels[other] })}
      aria-label={t("switchTo", { language: localeLabels[other] })}
      className="rounded-lg px-2.5 py-2 text-sm font-bold uppercase tracking-wide text-neutral-200 transition hover:bg-white/10 hover:text-white hover:cursor-pointer disabled:opacity-50"
    >
      {other}
    </button>
  );
}
