import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { siteConfig, pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/confidentialite",
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

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;
const MAIL = process.env.NEXT_PUBLIC_MAIL ?? "";

// Durée de conservation appliquée par la purge automatique (/api/cron/purge).
const RETENTION_MONTHS = 24;

const h2Cls = "mb-3 font-display text-xl font-bold text-white sm:text-2xl";
const liCls = "ml-5 list-disc marker:text-xbz-cyan";

/**
 * Balises rich communes aux paragraphes de contact : `<discord>` devient un
 * lien si l'invitation est configurée, du texte simple sinon ; `<mail>`
 * disparaît complètement quand aucune adresse n'est publiée (la phrase reste
 * grammaticale grâce au segment « ou par email… » placé DANS la balise).
 */
const contactTags = {
  discord: (chunks: ReactNode) =>
    DISCORD_URL ? (
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-xbz-cyan hover:underline"
      >
        {chunks}
      </a>
    ) : (
      <>{chunks}</>
    ),
  mail: (chunks: ReactNode) =>
    MAIL ? (
      <>
        {chunks}
        <a href={`mailto:${MAIL}`} className="font-semibold text-xbz-cyan hover:underline">
          {MAIL}
        </a>
      </>
    ) : null,
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
};

const COLLECTED_KEYS = ["recruitment", "support", "antispam"] as const;
const PROCESSOR_KEYS = ["supabase", "vercel", "discord"] as const;

export default async function ConfidentialitePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Locale passée EXPLICITEMENT : voir le commentaire de `force-static` ci-dessus.
  const t = await getTranslations({ locale, namespace: "privacy" });
  const tLegal = await getTranslations({ locale, namespace: "legal" });
  const tNotFound = await getTranslations({ locale, namespace: "notFound" });

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <header className="mb-12 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tLegal("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance leading-relaxed text-neutral-400">
          {t("intro", { name: siteConfig.name })}
        </p>
      </header>

      <div className="space-y-10 leading-relaxed text-neutral-300">
        <section aria-labelledby="responsable">
          <h2 id="responsable" className={h2Cls}>
            {t("controllerHeading")}
          </h2>
          <p>{t.rich("controllerText", { ...contactTags, name: siteConfig.name })}</p>
        </section>

        <section aria-labelledby="donnees">
          <h2 id="donnees" className={h2Cls}>
            {t("collectedHeading")}
          </h2>
          <p>{t("collectedIntro")}</p>
          <ul className="mt-3 space-y-1.5">
            {COLLECTED_KEYS.map((key) => (
              <li key={key} className={liCls}>
                {t.rich(`collected.${key}`, {
                  b: (chunks) => <strong className="text-neutral-200">{chunks}</strong>,
                })}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            {t.rich("collectedOutro", {
              legal: (chunks) => (
                <Link
                  href="/mentions-legales"
                  locale={locale}
                  className="font-semibold text-xbz-cyan hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </section>

        <section aria-labelledby="finalites">
          <h2 id="finalites" className={h2Cls}>
            {t("purposeHeading")}
          </h2>
          <p>{t.rich("purposeText1", contactTags)}</p>
          <p className="mt-2">{t.rich("purposeText2", contactTags)}</p>
          <p className="mt-2">{t.rich("purposeText3", contactTags)}</p>
        </section>

        <section aria-labelledby="duree">
          <h2 id="duree" className={h2Cls}>
            {t("retentionHeading")}
          </h2>
          <p>{t.rich("retentionText", { ...contactTags, months: RETENTION_MONTHS })}</p>
        </section>

        <section aria-labelledby="destinataires">
          <h2 id="destinataires" className={h2Cls}>
            {t("recipientsHeading")}
          </h2>
          <p>{t.rich("recipientsText", { ...contactTags, name: siteConfig.name })}</p>
          <p className="mt-2">{t("processorsIntro")}</p>
          <ul className="mt-3 space-y-1.5">
            {PROCESSOR_KEYS.map((key) => (
              <li key={key} className={liCls}>
                {t.rich(`processors.${key}`, {
                  b: (chunks) => <strong className="text-neutral-200">{chunks}</strong>,
                })}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="droits">
          <h2 id="droits" className={h2Cls}>
            {t("rightsHeading")}
          </h2>
          <p>{t("rightsText")}</p>
          <p className="mt-2">{t.rich("rightsContact", contactTags)}</p>
          <p className="mt-2">
            {t.rich("rightsComplaint", {
              cnil: (chunks) => (
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-xbz-cyan hover:underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </div>

      <p className="mt-12 text-center">
        <Link
          href="/"
          locale={locale}
          className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
        >
          <span aria-hidden="true">←</span> {tNotFound("backHome")}
        </Link>
      </p>
    </div>
  );
}
