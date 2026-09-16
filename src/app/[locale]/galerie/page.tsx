import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getMedias } from "@/lib/medias";
import MediaGallery from "@/components/MediaGallery";
import { pageMetadata } from "@/lib/site";

// Rendu statique régénéré en arrière-plan (ISR). Les médias viennent de la base ;
// le back-office invalide le cache à chaque écriture. `force-static` est requis
// sous `[locale]` (cf. le commentaire détaillé sur /boutique).
export const dynamic = "force-static";
export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "galerie" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/galerie",
    locale,
  });
}

export default async function GaleriePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "galerie" });
  const medias = await getMedias();

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <header className="mb-12 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      {medias.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("empty")}</p>
      ) : (
        <MediaGallery medias={medias} />
      )}
    </div>
  );
}
