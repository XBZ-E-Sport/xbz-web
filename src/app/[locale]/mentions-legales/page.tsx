import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { siteConfig, pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  // Locale passée EXPLICITEMENT : voir le commentaire de `force-static` ci-dessus.
  const t = await getTranslations({ locale, namespace: "legal" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/mentions-legales",
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

const h2Cls = "mb-3 font-display text-xl font-bold text-white sm:text-2xl";

// NB : le responsable de publication et l'hébergeur sont des faits, pas du
// contenu éditorial — ils vivent dans les traductions pour que la phrase qui
// les entoure reste naturelle, mais leurs valeurs sont identiques en FR et EN.
export default async function MentionsLegalesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Locale passée EXPLICITEMENT : voir le commentaire de `force-static` ci-dessus.
  const t = await getTranslations({ locale, namespace: "legal" });
  const tNotFound = await getTranslations({ locale, namespace: "notFound" });

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <header className="mb-12 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
      </header>

      <div className="space-y-10 leading-relaxed text-neutral-300">
        <section aria-labelledby="editeur">
          <h2 id="editeur" className={h2Cls}>
            {t("publisherHeading")}
          </h2>
          <p>{t("publisherText", { name: siteConfig.name })}</p>
          <p className="mt-2">
            {t.rich("publisherManager", {
              manager: (chunks) => <span className="text-neutral-400">{chunks}</span>,
            })}
          </p>
          <p className="mt-2">
            {t.rich("contact", {
              discord: (chunks) =>
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
            })}
          </p>
        </section>

        <section aria-labelledby="hebergement">
          <h2 id="hebergement" className={h2Cls}>
            {t("hostingHeading")}
          </h2>
          <p>
            {t.rich("hostingText", {
              vercel: (chunks) => (
                <a
                  href="https://vercel.com"
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

        <section aria-labelledby="propriete">
          <h2 id="propriete" className={h2Cls}>
            {t("ipHeading")}
          </h2>
          <p>{t("ipText", { name: siteConfig.name })}</p>
        </section>

        <section aria-labelledby="donnees">
          <h2 id="donnees" className={h2Cls}>
            {t("dataHeading")}
          </h2>
          <p>{t("dataText1")}</p>
          <p className="mt-2">{t("dataText2")}</p>
          <p className="mt-2">
            {t.rich("dataText3", {
              privacy: (chunks) => (
                <Link
                  href="/confidentialite"
                  locale={locale}
                  className="font-semibold text-xbz-cyan hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </section>

        <section aria-labelledby="cookies">
          <h2 id="cookies" className={h2Cls}>
            {t("cookiesHeading")}
          </h2>
          <p>{t("cookiesText")}</p>
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
