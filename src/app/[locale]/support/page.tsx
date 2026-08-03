import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import SupportForm from "@/components/SupportForm";
import { jsonLdString } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "support" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/support",
    locale,
  });
}

// Rendu statique explicite.
//
// Depuis le passage sous le segment `[locale]`, la racine de l'app vit dans un
// segment dynamique : Next n'infère plus le prérendu tout seul et bascule la
// route en rendu à la demande. Cette page n'a aucune donnée liée à la requête
// (pas de base, pas de cookie, pas d'en-tête) — on rétablit donc le prérendu au
// build, comme avant l'i18n. `generateStaticParams` du layout fournit les deux
// langues, donc les deux versions sont générées.
export const dynamic = "force-static";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";
const MAIL = process.env.NEXT_PUBLIC_MAIL ?? "";

// Icônes + destinations ici, libellés dans `support.needs.*`.
const demandes = [
  { key: "recrutement", icon: "📝", href: "/recrutement" },
  {
    key: "partenariat",
    icon: "🤝",
    href: `mailto:${MAIL}?subject=${encodeURIComponent("Partenariat — XBZ")}`,
  },
  { key: "signalement", icon: "🚨", href: DISCORD_URL },
  {
    key: "presse",
    icon: "📣",
    href: `mailto:${MAIL}?subject=${encodeURIComponent("Presse — XBZ")}`,
  },
] as const;

// Les six questions de la FAQ, dans l'ordre d'affichage.
const FAQ_KEYS = ["join", "followUp", "games", "partner", "report", "shop"] as const;

// Libellés reçus en props plutôt que lus par un hook : sous `force-static`
// il n'y a pas de contexte de langue à l'intérieur du composant.
function DemandeCard({
  demande,
  title,
  text,
  locale,
}: {
  demande: (typeof demandes)[number];
  title: string;
  text: string;
  locale: string;
}) {
  const inner = (
    <>
      <span aria-hidden="true" className="text-2xl leading-none">
        {demande.icon}
      </span>
      <div>
        <h3 className="font-display text-base text-xbz-blue">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">{text}</p>
      </div>
    </>
  );
  const cls =
    "card-xbz flex h-full items-start gap-3 p-5 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1";

  if (demande.href.startsWith("/")) {
    return (
      <Link href={demande.href} locale={locale} className={cls}>
        {inner}
      </Link>
    );
  }
  const isExternal = demande.href.startsWith("http");
  return (
    <a
      href={demande.href}
      className={cls}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

export default async function SupportPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Locale passée EXPLICITEMENT : sous `force-static` il n'y a pas de requête,
  // donc pas de langue « ambiante » — `getTranslations()` sans argument
  // retomberait sur le français et rendrait la page anglaise en français.
  const t = await getTranslations({ locale, namespace: "support" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  // JSON-LD FAQPage (SEO : rich results Google), dans la langue de la page.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_KEYS.map((key) => ({
      "@type": "Question",
      name: t(`faq.${key}.q`),
      acceptedAnswer: { "@type": "Answer", text: t(`faq.${key}.a`) },
    })),
  };

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
      {/* En-tête */}
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("support")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-xbz-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-semibold text-xbz-cyan">
          <span aria-hidden="true">⏱️</span> {t("responseTime")}
        </p>
      </header>

      {/* Canaux de contact */}
      <section aria-labelledby="canaux-heading" className="mb-16">
        <h2
          id="canaux-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("channelsHeading")}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="card-xbz flex flex-col p-6 text-center">
            <span aria-hidden="true" className="text-3xl">
              💬
            </span>
            <h3 className="mt-3 font-display text-lg text-white">{tNav("discord")}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
              {t("discordText")}
            </p>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 rounded-xl bg-[#5865F2] px-6 py-3 font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              {tNav("joinDiscord")}
              <span className="sr-only">{tNav("newTab")}</span>
            </a>
          </div>

          <div className="card-xbz flex flex-col p-6 text-center">
            <span aria-hidden="true" className="text-3xl">
              ✉️
            </span>
            <h3 className="mt-3 font-display text-lg text-white">{t("emailTitle")}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
              {t("emailText")}
            </p>
            <a
              href={`mailto:${MAIL}`}
              className="mt-4 rounded-xl border border-white/25 px-6 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
            >
              {t("emailCta")}
            </a>
          </div>
        </div>
      </section>

      {/* Aiguillage par type de demande */}
      <section aria-labelledby="demandes-heading" className="mb-16">
        <h2
          id="demandes-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("needsHeading")}
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {demandes.map((demande) => (
            <li key={demande.key}>
              <DemandeCard
                demande={demande}
                title={t(`needs.${demande.key}.title`)}
                text={t(`needs.${demande.key}.text`)}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="mb-16">
        <h2
          id="faq-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("faqHeading")}
        </h2>
        <div className="flex flex-col gap-3">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="card-xbz group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
                {t(`faq.${key}.q`)}
                <span
                  aria-hidden="true"
                  className="text-xbz-cyan transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t(`faq.${key}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Formulaire de contact */}
      <section aria-labelledby="form-heading" className="mb-16">
        <h2
          id="form-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("formHeading")}
        </h2>
        <div className="card-xbz p-6 sm:p-8">
          <SupportForm />
        </div>
      </section>

      {/* Charte de contact */}
      <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-neutral-400">
        ⚠️ {t("charter")}
      </p>
    </div>
  );
}
