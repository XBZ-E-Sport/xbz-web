import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPartners, type Partner } from "@/lib/partenaires";
import { pageMetadata } from "@/lib/site";

// Rendu statique régénéré en arrière-plan (ISR). Les partenaires viennent de la
// base ; le back-office invalide le cache à chaque écriture. `force-static` est
// requis sous `[locale]` (cf. le commentaire détaillé sur /boutique).
export const dynamic = "force-static";
export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partenaires" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/partenaires",
    locale,
  });
}

/** Carte d'un partenaire : logo (ou nom), mention, lien vers son site. */
function PartnerCard({ partner, visitLabel, newTab }: { partner: Partner; visitLabel: string; newTab: string }) {
  const inner = (
    <>
      {/* Logo sur fond clair : beaucoup de logos sont sombres/transparents et
          disparaîtraient sur le fond du site. `object-contain` respecte le ratio. */}
      <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-white/90 p-4">
        {partner.logo ? (
          <Image
            src={partner.logo}
            alt={partner.name}
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-contain p-4"
          />
        ) : (
          <span className="font-display text-lg font-bold text-neutral-800">{partner.name}</span>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg text-white">{partner.name}</h3>
      {partner.description && (
        <p className="mt-1 text-sm leading-relaxed text-neutral-400">{partner.description}</p>
      )}
      {partner.url && (
        <span className="mt-3 inline-block text-sm font-semibold text-xbz-cyan">
          {visitLabel} →
        </span>
      )}
    </>
  );

  // Lien externe (site du partenaire) → ancre classique, nouvel onglet. Pas le
  // composant Link de next-intl : la cible est hors du site.
  return partner.url ? (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="card-xbz block p-6 text-center transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
    >
      {inner}
      <span className="sr-only">{newTab}</span>
    </a>
  ) : (
    <div className="card-xbz p-6 text-center">{inner}</div>
  );
}

/** Une section (Sponsors ou Partenaires) : titre + grille de cartes. */
function PartnerSection({
  id,
  heading,
  partners,
  visitLabel,
  newTab,
}: {
  id: string;
  heading: string;
  partners: Partner[];
  visitLabel: string;
  newTab: string;
}) {
  if (partners.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mb-16">
      <h2 id={id} className="mb-6 font-display text-xl font-bold tracking-[2px] text-neutral-300">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {partners.map((partner) => (
          <li key={partner.id}>
            <PartnerCard partner={partner} visitLabel={visitLabel} newTab={newTab} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PartenairesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "partenaires" });
  const partners = await getPartners(locale);
  const sponsors = partners.filter((p) => p.type === "sponsor");
  const others = partners.filter((p) => p.type === "partenaire");

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(220,37,21,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      {partners.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("empty")}</p>
      ) : (
        <>
          <PartnerSection
            id="sponsors-heading"
            heading={t("sponsorsHeading")}
            partners={sponsors}
            visitLabel={t("visit")}
            newTab={t("newTab")}
          />
          <PartnerSection
            id="partners-heading"
            heading={t("partnersHeading")}
            partners={others}
            visitLabel={t("visit")}
            newTab={t("newTab")}
          />
        </>
      )}

      <div className="card-xbz mt-4 p-8 text-center sm:p-10">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-neutral-300">{t("ctaText")}</p>
      </div>
    </div>
  );
}
