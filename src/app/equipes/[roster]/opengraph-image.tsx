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
  params: Promise<{ roster: string }>;
}) {
  const { roster: slug } = await params;

  const roster = await getRosterBySlug(slug);
  if (roster) {
    return ogImage({
      eyebrow: roster.rank ?? "Roster",
      title: roster.name,
      subtitle: roster.description ?? `L'effectif ${roster.name} de XBZ Esport.`,
    });
  }

  const pole = await getPoleBySlug(slug);
  if (pole) {
    return ogImage({
      eyebrow: pole.category === "esport" ? "Pôle esport" : "Pôle staff",
      title: pole.name,
      subtitle: pole.description ?? `Le pôle ${pole.name} de XBZ Esport.`,
    });
  }

  return ogImage({ eyebrow: "Équipes", title: "Page introuvable" });
}
