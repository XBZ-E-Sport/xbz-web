import { getTranslations } from "next-intl/server";

import { getPlayer, type Player } from "@/lib/roster";
import { getPoleBySlug } from "@/lib/equipes";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const dynamic = "force-dynamic";
export const alt = "Membre XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Résout un membre : d'abord un joueur de roster, sinon un membre de pôle.
async function resolveMember(
  parentSlug: string,
  memberSlug: string,
  locale: string,
): Promise<{ player: Player; parentName: string; isPole: boolean } | null> {
  const res = await getPlayer(parentSlug, memberSlug, locale);
  if (res) return { player: res.player, parentName: res.roster.name, isPole: false };

  const pole = await getPoleBySlug(parentSlug, locale);
  const member = pole?.members.find((m) => m.slug === memberSlug);
  if (pole && member) return { player: member, parentName: pole.name, isPole: true };

  return null;
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; roster: string; joueur: string }>;
}) {
  const { locale, roster, joueur } = await params;
  const t = await getTranslations({ locale, namespace: "og" });
  const res = await resolveMember(roster, joueur, locale);

  if (!res) {
    return ogImage({ eyebrow: t("member"), title: t("memberNotFound") });
  }

  const tJoueur = await getTranslations({ locale, namespace: "joueur" });
  const tRole = await getTranslations({ locale, namespace: "playerRoles" });
  const { player, parentName, isPole } = res;
  // Pour un pôle, le pôle EST le rôle (pas de sous-rôle).
  const role = tRole.has(player.role) ? tRole(player.role) : player.role;
  const eyebrow = isPole ? parentName : `${role} · ${parentName}`;
  const subtitle =
    [player.nom, player.rang ? `${tJoueur("rank")} ${player.rang}` : null, player.pays]
      .filter(Boolean)
      .join("  ·  ") || null;

  return ogImage({ eyebrow, title: player.pseudo, subtitle });
}
