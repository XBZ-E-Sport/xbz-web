import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getProducts } from "@/lib/boutique";
import BoutiqueList from "@/components/BoutiqueList";
import { pageMetadata } from "@/lib/site";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "boutique" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/boutique",
    locale,
  });
}

// Rendu statique régénéré en arrière-plan (ISR), au lieu d'un rendu serveur
// par visite. Les produits venaient d'une lecture BDD par affichage.
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

export default async function BoutiquePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "boutique" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const products = await getProducts(locale);
  // Bandeau « ouvre bientôt » tant qu'aucun produit n'est achetable.
  const anyAvailable = products.some((p) => p.available);

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      {/* En-tête */}
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("boutique")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      {/* Bandeau ouverture prochaine (tant qu'aucun produit n'est achetable) */}
      {!anyAvailable && (
        <p
          role="status"
          className="mx-auto mb-12 flex max-w-xl items-center justify-center gap-2 rounded-xl border border-xbz-cyan/30 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-xbz-cyan"
        >
          <span aria-hidden="true">🛒</span>
          {t("openingSoon")}
        </p>
      )}

      {products.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("empty")}</p>
      ) : (
        <BoutiqueList products={products} />
      )}

      {/* CTA */}
      <div className="card-xbz mt-16 p-8 text-center sm:p-10">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-neutral-300">{t("ctaText")}</p>
        <div className="mt-7 flex justify-center">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#5865F2] px-8 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
          >
            {tNav("joinDiscord")}
            <span className="sr-only">{tNav("newTab")}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
