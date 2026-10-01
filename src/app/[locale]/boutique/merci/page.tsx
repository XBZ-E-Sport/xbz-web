import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import ClearCart from "@/components/ClearCart";
import { Link } from "@/i18n/navigation";
import { formatEuros } from "@/lib/money";
import { orderNumber } from "@/lib/shop";
import { isStripeConfigured, stripe } from "@/lib/stripe";

// Confirmation après un paiement Stripe.
//
// Purement INFORMATIVE : elle relit la session pour dire « merci » avec le bon
// montant, mais n'enregistre RIEN — la commande est confirmée par le webhook
// signé (/api/stripe/webhook). Ouverte sans avoir payé, elle affiche un
// message neutre et laisse le panier intact.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orderConfirm" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Montant, email et numéro de commande d'une session PAYÉE, sinon null. */
async function readPaidSession(sessionId: string | undefined, locale: string) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !isStripeConfigured()) return null;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return null;
    const orderId = session.metadata?.order_id ?? session.client_reference_id;
    return {
      amount: formatEuros((session.amount_total ?? 0) / 100, locale),
      email: session.customer_details?.email ?? null,
      number: orderId ? orderNumber(orderId) : null,
    };
  } catch {
    return null;
  }
}

export default async function OrderConfirmPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "orderConfirm" });
  const { session_id } = await searchParams;
  const order = await readPaidSession(session_id, locale);

  return (
    <section className="relative z-10 mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      {order && <ClearCart />}
      <span aria-hidden="true" className="text-6xl">
        {order ? "✅" : "⏳"}
      </span>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(220,37,21,0.4)] sm:text-4xl">
        {order ? t("title") : t("processingTitle")}
      </h1>

      {order ? (
        <div className="flex flex-col gap-2 text-lg leading-relaxed text-neutral-300">
          <p>{t("lead")}</p>
          {order.number && <p className="font-semibold text-white">{t("number", { number: order.number })}</p>}
          <p className="font-semibold text-white">{t("amount", { amount: order.amount })}</p>
          {order.email && <p className="text-sm text-neutral-400">{t("email", { email: order.email })}</p>}
          <p className="text-sm text-neutral-400">{t("next")}</p>
        </div>
      ) : (
        <p className="text-lg leading-relaxed text-neutral-300">{t("processing")}</p>
      )}

      <Link
        href="/boutique"
        locale={locale}
        className="mt-2 rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
      >
        {t("back")}
      </Link>
    </section>
  );
}
