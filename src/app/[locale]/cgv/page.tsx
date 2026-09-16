import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/site";

// Rendu statique explicite (aucune donnée liée à la requête), comme les autres
// pages légales. `generateStaticParams` du layout fournit les deux langues.
export const dynamic = "force-static";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cgv" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/cgv",
    locale,
  });
}

// Articles rendus dans l'ordre ; chaque `${id}Body` peut contenir plusieurs
// paragraphes séparés par une ligne vide. Deux articles ont un complément :
// le formulaire type (rétractation) et le lien vers la confidentialité (données).
const ARTICLES = [
  "objet",
  "vendeur",
  "produits",
  "prix",
  "commande",
  "paiement",
  "livraison",
  "retractation",
  "garanties",
  "responsabilite",
  "donnees",
  "litiges",
] as const;

const h2Cls = "mb-3 font-display text-xl font-bold text-white sm:text-2xl";

export default async function CgvPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "cgv" });
  const tNotFound = await getTranslations({ locale, namespace: "notFound" });

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-sm text-neutral-400">{t("effective")}</p>
      </header>

      <div className="space-y-10 leading-relaxed text-neutral-300">
        {ARTICLES.map((id, i) => (
          <section key={id} aria-labelledby={id}>
            <h2 id={id} className={h2Cls}>
              {i + 1}. {t(`${id}Title`)}
            </h2>
            {t(`${id}Body`)
              .split("\n\n")
              .map((paragraph, j) => (
                <p key={j} className={j > 0 ? "mt-3" : undefined}>
                  {paragraph}
                </p>
              ))}

            {id === "retractation" && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="font-semibold text-white">{t("retractationFormTitle")}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-neutral-400">
                  {t("retractationForm")}
                </p>
              </div>
            )}

            {id === "donnees" && (
              <p className="mt-3">
                <Link
                  href="/confidentialite"
                  locale={locale}
                  className="font-semibold text-xbz-cyan hover:underline"
                >
                  {t("donneesLink")}
                </Link>
              </p>
            )}
          </section>
        ))}
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
