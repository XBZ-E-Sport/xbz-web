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

// Rendu statique régénéré en arrière-plan (ISR), au lieu d'un rendu serveur
// par visite. Rôles et rosters ouverts venaient d'une lecture BDD par affichage.
//
// La fraîcheur ne dépend pas de ce délai : le back-office appelle
// `revalidateLocalizedPath` à chaque écriture, ce qui régénère la page tout de
// suite. Le nombre ci-dessous n'est qu'un filet — si une invalidation était
// oubliée, la page se remet à jour d'elle-même au bout d'une heure.
//
// Littéral obligatoire : Next lit cette valeur au build, une constante importée
// ne serait pas analysable (cf. CACHE_TTL_SECONDS, même durée).//
// `force-static` en plus de `revalidate` : sous le segment `[locale]`, Next
// n'infère plus le prérendu tout seul (la racine de l'app est un segment
// dynamique) et bascule la route en rendu à la demande. Il faut le lui dire.
export const dynamic = "force-static";
export const revalidate = 3600;

export default async function RecrutementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "recrutement" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

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
            <Link href="/equipes" locale={locale} className="font-semibold text-xbz-cyan hover:underline">
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
