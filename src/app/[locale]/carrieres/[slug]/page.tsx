import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getOfferBySlug, getOfferSlugs, jobPostingJsonLd, type Offer } from "@/lib/offres";
import { formatDate } from "@/lib/format";
import { jsonLdString } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/site";

// ISR : la fiche d'offre est prégénérée au build (slugs connus) et régénérée en
// arrière-plan. `force-static` est requis sous `[locale]` pour qu'une offre
// publiée après le build soit malgré tout mise en cache à sa première visite
// (voir le même commentaire, détaillé, sur /actualite/[slug]).
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getOfferSlugs()).map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  const offer = await getOfferBySlug(slug, locale);
  if (!offer) {
    const t = await getTranslations({ locale, namespace: "offerDetail" });
    return { title: t("metaNotFound") };
  }
  return pageMetadata({
    title: `${offer.title} — XBZ Esport`,
    description: offer.excerpt,
    path: `/carrieres/${offer.slug}`,
    locale,
  });
}

/** Rémunération formatée, ou null si non renseignée. */
function formatSalary(offer: Offer, locale: string, periodLabel: string): string | null {
  if (offer.salaryMin === null && offer.salaryMax === null) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-IE" : "fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  const range =
    offer.salaryMin !== null && offer.salaryMax !== null && offer.salaryMin !== offer.salaryMax
      ? `${money(offer.salaryMin)} – ${money(offer.salaryMax)}`
      : money((offer.salaryMin ?? offer.salaryMax)!);
  return `${range} / ${periodLabel}`;
}

export default async function OfferPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "offerDetail" });
  const tType = await getTranslations({ locale, namespace: "employmentTypes" });
  const tPeriod = await getTranslations({ locale, namespace: "salaryPeriods" });

  const offer = await getOfferBySlug(slug, locale);
  if (!offer) notFound();

  // Données structurées JobPosting : ce que lisent Indeed et Google for Jobs.
  const jsonLd = jobPostingJsonLd(offer);

  const location = offer.remote
    ? t("remoteLocation")
    : [offer.city, offer.region, offer.postalCode].filter(Boolean).join(", ") || offer.country;
  const salary = formatSalary(offer, locale, tPeriod(offer.salaryPeriod));

  // Où postuler : un lien externe fourni (ATS web ou mailto:), sinon le
  // formulaire de recrutement du site. Le `mailto:` ouvre le client mail — pas
  // de nouvel onglet ; le lien web s'ouvre dans un onglet neuf.
  const apply = offer.applyUrl?.match(/^https?:\/\//)
    ? { kind: "web" as const, href: offer.applyUrl }
    : offer.applyUrl?.match(/^mailto:/)
      ? { kind: "mail" as const, href: offer.applyUrl }
      : { kind: "internal" as const };
  const applyCls =
    "mt-4 inline-block rounded-xl bg-xbz-blue px-7 py-3.5 font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5";

  const facts: { label: string; value: string }[] = [
    { label: t("contractType"), value: tType(offer.employmentType) },
    { label: t("location"), value: location },
    ...(offer.department ? [{ label: t("department"), value: offer.department }] : []),
    ...(salary ? [{ label: t("salary"), value: salary }] : []),
    ...(offer.validThrough
      ? [{ label: t("validUntil"), value: formatDate(offer.validThrough, locale) }]
      : []),
  ];

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <Link
        href="/carrieres"
        locale={locale}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> {t("back")}
      </Link>

      <article className="mt-6">
        <h1 className="font-display text-3xl font-black leading-tight text-white sm:text-4xl">
          {offer.title}
        </h1>
        <time dateTime={offer.datePosted} className="mt-2 block text-sm text-neutral-400">
          {t("postedOn", { date: formatDate(offer.datePosted, locale) })}
        </time>

        {/* Faits saillants : lus par un humain, doublés par le JSON-LD pour Indeed. */}
        <dl className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {f.label}
              </dt>
              <dd className="mt-0.5 text-sm text-white">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-neutral-300">
          {offer.description.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </article>

      <div className="mt-12 border-t border-white/10 pt-8 text-center">
        <p className="text-neutral-300">{t("applyLead")}</p>
        {apply.kind === "web" ? (
          <a href={apply.href} target="_blank" rel="noopener noreferrer" className={applyCls}>
            {t("apply")}
          </a>
        ) : apply.kind === "mail" ? (
          <a href={apply.href} className={applyCls}>
            {t("apply")}
          </a>
        ) : (
          <Link href="/recrutement" locale={locale} className={applyCls}>
            {t("apply")}
          </Link>
        )}
      </div>
    </div>
  );
}
