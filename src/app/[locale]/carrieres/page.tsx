import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getOffers } from "@/lib/offres";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/site";

// Rendu statique régénéré en arrière-plan (ISR). Les offres viennent de la base ;
// le back-office invalide le cache à chaque écriture. Voir /carrieres/[slug] pour
// le détail de la contrainte `force-static` sous le segment `[locale]`.
export const dynamic = "force-static";
export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "carrieres" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/carrieres",
    locale,
  });
}

export default async function CarrieresPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "carrieres" });
  const tType = await getTranslations({ locale, namespace: "employmentTypes" });
  const offers = await getOffers(locale);

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      {offers.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {offers.map((offer) => {
            const location = offer.remote
              ? t("remote")
              : [offer.city, offer.region].filter(Boolean).join(", ") || offer.country;
            return (
              <li key={offer.slug}>
                <Link
                  href={`/carrieres/${offer.slug}`}
                  locale={locale}
                  className="card-xbz block p-6 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-display text-xl text-xbz-blue">{offer.title}</h2>
                    <span className="rounded-md bg-xbz-blue/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#7fc8ff]">
                      {tType(offer.employmentType)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
                    {offer.department && <span>🧩 {offer.department}</span>}
                    <span>📍 {location}</span>
                    <span>🗓️ {t("postedOn", { date: formatDate(offer.datePosted, locale) })}</span>
                  </div>

                  {offer.excerpt && (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">{offer.excerpt}</p>
                  )}

                  <span className="mt-4 inline-block text-sm font-semibold text-xbz-cyan">
                    {t("seeOffer")} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
