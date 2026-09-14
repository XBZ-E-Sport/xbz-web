import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { stripe, isStripeConfigured } from "@/lib/stripe";

// Page de confirmation après un paiement Stripe.
//
// Purement INFORMATIVE : elle lit la session pour dire « merci » avec le bon
// montant, mais n'enregistre RIEN — la commande est écrite par le webhook signé
// (cf. /api/stripe/webhook). Si quelqu'un ouvre cette URL sans avoir payé, il
// voit juste un message neutre.
//
// Dépend de la query `session_id` → rendu à la demande, jamais mis en cache.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "boutique" });
  // Confirmation propre à une commande : jamais indexée.
  return { title: t("thanksTitle"), robots: { index: false, follow: false } };
}

/** Récupère montant + email de la session, ou null si indisponible. */
async function readSession(
  sessionId: string | undefined,
  locale: string,
): Promise<{ amount: string; email: string | null } | null> {
  if (!sessionId || !isStripeConfigured()) return null;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return null;
    const amount = new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
      style: "currency",
      currency: (session.currency ?? "eur").toUpperCase(),
    }).format((session.amount_total ?? 0) / 100);
    return { amount, email: session.customer_details?.email ?? null };
  } catch {
    // Session inconnue / erreur Stripe : on reste sur le message neutre.
    return null;
  }
}

export default async function MerciPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "boutique" });

  const { session_id } = await searchParams;
  const order = await readSession(session_id, locale);

  return (
    <section className="relative z-10 mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <span aria-hidden="true" className="text-6xl">
        ✅
      </span>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-4xl">
        {t("thanksTitle")}
      </h1>

      {order ? (
        <div className="flex flex-col gap-2 text-lg leading-relaxed text-neutral-300">
          <p>{t("thanksLead")}</p>
          <p className="font-semibold text-white">{t("thanksAmount", { amount: order.amount })}</p>
          {order.email && (
            <p className="text-sm text-neutral-400">{t("thanksEmail", { email: order.email })}</p>
          )}
        </div>
      ) : (
        <p className="text-lg leading-relaxed text-neutral-300">{t("thanksProcessing")}</p>
      )}

      <Link
        href="/boutique"
        locale={locale}
        className="mt-2 rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
      >
        {t("thanksBack")}
      </Link>
    </section>
  );
}
