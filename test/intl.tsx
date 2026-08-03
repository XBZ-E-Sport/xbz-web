// Helper de rendu pour les tests de composants CLIENT qui lisent des traductions.
//
// `useTranslations` exige le contexte de `NextIntlClientProvider` : sans lui,
// next-intl throw. On monte donc le provider avec les VRAIS messages du dépôt,
// pas des faux — ainsi un test casse aussi quand une clé disparaît du JSON.

import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import fr from "../messages/fr.json";
import en from "../messages/en.json";

const MESSAGES = { fr, en } as const;

export type TestLocale = keyof typeof MESSAGES;

/** `render()` de Testing Library, enveloppé dans le contexte de langue. */
export function renderIntl(
  ui: ReactElement,
  { locale = "fr", ...options }: RenderOptions & { locale?: TestLocale } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        // Fuseau figé : sinon un test qui formate une date dépend de la machine.
        timeZone="Europe/Paris"
      >
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

/** Accès aux messages bruts, pour asserter sur le libellé attendu sans le recopier. */
export function messages(locale: TestLocale = "fr") {
  return MESSAGES[locale];
}
