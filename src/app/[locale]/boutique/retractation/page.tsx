import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import ClientMessages from "@/components/ClientMessages";
import WithdrawalForm from "@/components/WithdrawalForm";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "withdrawal" });
  // Page utilitaire (formulaire) : utile à qui a commandé, rien à indexer. Elle
  // reste atteignable depuis le pied de chaque page, comme la loi le demande.
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/boutique/retractation",
    locale,
    noindex: true,
  });
}

// Aucune donnée liée à la requête : prérendue, une fois par langue.
export const dynamic = "force-static";

const linkCls = "font-semibold text-xbz-cyan hover:underline";

export default async function WithdrawalPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "withdrawal" });

  return (
    <div className="relative z-10 mx-auto max-w-2xl px-6 pb-24 pt-32">
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">{t("eyebrow")}</p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(220,37,21,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance leading-relaxed text-neutral-400">{t("intro")}</p>
      </header>

      <div className="card-xbz p-6 sm:p-8">
        <ClientMessages locale={locale} clients={["WithdrawalForm"]}>
          <WithdrawalForm />
        </ClientMessages>
      </div>

      <p className="mt-6 text-center text-sm leading-relaxed text-neutral-400">
        {t.rich("altWays", {
          email: LEGAL.email,
          mail: (chunks: ReactNode) => (
            <a href={`mailto:${LEGAL.email}`} className={linkCls}>
              {chunks}
            </a>
          ),
          cgv: (chunks: ReactNode) => (
            <Link href="/cgv" locale={locale} className={linkCls}>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
