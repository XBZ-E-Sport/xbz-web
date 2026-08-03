import { getTranslations } from "next-intl/server";

import { getRosterBySlug } from "@/lib/roster";
import { getPoleBySlug } from "@/lib/equipes";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

// Le segment [roster] résout d'abord un roster, puis un pôle (URL à plat).
export const dynamic = "force-dynamic";
export const alt = "Équipe XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; roster: string }>;
}) {
  const { locale, roster: slug } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  const tDetail = await getTranslations({ locale, namespace: "equipeDetail" });

  const roster = await getRosterBySlug(slug);
  if (roster) {
    return ogImage({
      eyebrow: roster.rank ?? t("roster"),
      title: roster.name,
      subtitle: roster.description ?? tDetail("metaRoster", { name: roster.name }),
    });
  }

  const pole = await getPoleBySlug(slug);
  if (pole) {
    return ogImage({
      eyebrow: pole.category === "esport" ? tDetail("poleEsport") : tDetail("poleStaff"),
      title: pole.name,
      subtitle: pole.description ?? tDetail("metaPole", { name: pole.name }),
    });
  }

  const tNotFound = await getTranslations({ locale, namespace: "notFound" });
  return ogImage({ eyebrow: t("equipes.eyebrow"), title: tNotFound("title") });
}
