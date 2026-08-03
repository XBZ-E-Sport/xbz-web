import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import RecrutementForm from "@/components/RecrutementForm";
import { getOpenRolesByCategory, getOpenRosters } from "@/lib/equipes";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recrutement" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/recrutement",
    locale,
  });
}

// Rôles + rosters ouverts lus en base à chaque visite.
export const dynamic = "force-dynamic";

export default async function RecrutementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("recrutement");
  const tNav = await getTranslations("nav");

  const [rolesByCategory, rosters] = await Promise.all([
    getOpenRolesByCategory(),
    getOpenRosters(),
  ]);
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-6 pb-24 pt-32">
      {/* En-tête */}
      <header className="mb-8 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("recrutement")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-xbz-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-semibold text-xbz-cyan">
          <span aria-hidden="true">🔞</span> {t("ageNotice")}
        </p>
      </header>

      <p className="mb-8 text-center text-sm text-neutral-400">
        {t.rich("seeOpenRoles", {
          teams: (chunks) => (
            <Link href="/equipes" className="font-semibold text-xbz-cyan hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      {/* Formulaire */}
      <div className="card-xbz p-6 sm:p-8">
        <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />
      </div>
    </div>
  );
}
