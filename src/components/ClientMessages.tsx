import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { pickMessages, type ClientComponent } from "@/i18n/client-messages";

/**
 * Fournit à des composants client de la page LEURS messages, et rien d'autre
 * (voir src/i18n/client-messages.ts).
 *
 * `locale` et `messages` explicites, comme dans le layout : sous
 * `force-static`, il n'y a pas de requête dont next-intl pourrait les déduire.
 */
export default async function ClientMessages({
  locale,
  clients,
  children,
}: {
  locale: string;
  clients: readonly ClientComponent[];
  children: React.ReactNode;
}) {
  const messages = await getMessages({ locale });
  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, clients)}>
      {children}
    </NextIntlClientProvider>
  );
}
