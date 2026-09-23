import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getRosterBySlug } from "@/lib/roster";
import { getEquipeSlugs, getPoleBySlug } from "@/lib/equipes";
import { getRosterMatchBoards } from "@/lib/matchs";
import { pageMetadata } from "@/lib/site";
import PlayerCard from "@/components/PlayerCard";
import MatchCard, { type MatchLabels } from "@/components/MatchCard";

// Rendu statique régénéré en arrière-plan (ISR), au lieu d'un rendu serveur
// par visite. Roster ou pôle venait d'une lecture BDD par affichage.
//
// `force-static` est indispensable, et pas seulement à cause du segment
// `[locale]` : la doc de Next le dit pour les routes dynamiques — sans lui, une
// page dont le slug n'était pas connu au build ne serait jamais mise en cache
// après coup. Un membre ajouté cet après-midi resterait en rendu par visite
// jusqu'au prochain déploiement.
//
// Les slugs inconnus de `generateStaticParams` restent servis à la demande
// (`dynamicParams` vaut true par défaut), puis mis en cache.
export const dynamic = "force-static";
export const revalidate = 3600;

/** Prégénère les rosters ET les pôles : ils partagent cette route. */
export async function generateStaticParams() {
  return (await getEquipeSlugs()).map((roster) => ({ roster }));
}

type PageProps = { params: Promise<{ locale: string; roster: string }> };

// Le segment [roster] résout d'abord un roster, puis un pôle (URL à plat :
// /equipes/ssl comme /equipes/moderateurs). Un roster gagne en cas d'homonymie.
export async function generateMetadata({ params }: PageProps) {
  const { locale, roster: slug } = await params;
  const t = await getTranslations({ locale, namespace: "equipeDetail" });

  const roster = await getRosterBySlug(slug, locale);
  if (roster) {
    return pageMetadata({
      title: `${roster.name} — XBZ Esport`,
      description: roster.description ?? t("metaRoster", { name: roster.name }),
      path: `/equipes/${roster.slug}`,
      locale,
    });
  }
  const pole = await getPoleBySlug(slug, locale);
  if (pole) {
    return pageMetadata({
      title: `${pole.name} — XBZ Esport`,
      description: pole.description ?? t("metaPole", { name: pole.name }),
      path: `/equipes/${pole.slug}`,
      locale,
    });
  }
  const tNotFound = await getTranslations({ locale, namespace: "notFound" });
  return { title: tNotFound("metaTitle") };
}

export default async function EquipeDetailPage({ params }: PageProps) {
  const { locale, roster: slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "equipeDetail" });

  const roster = await getRosterBySlug(slug, locale);
  if (roster) {
    return (
      <DetailLayout
        backLabel={t("backToTeams")}
        locale={locale}
        eyebrow={roster.rank}
        title={roster.name}
        description={roster.description}
        emptyLabel={t("emptyRoster")}
        count={roster.players.length}
        after={await RosterMatchs({ rosterId: roster.id, locale })}
      >
        {roster.players.map((player) => (
          <PlayerCard key={player.id} player={player} parentSlug={roster.slug} />
        ))}
      </DetailLayout>
    );
  }

  const pole = await getPoleBySlug(slug, locale);
  if (pole) {
    return (
      <DetailLayout
        backLabel={t("backToTeams")}
        locale={locale}
        eyebrow={pole.category === "esport" ? t("poleEsport") : t("poleStaff")}
        title={pole.name}
        description={pole.description}
        emptyLabel={t("emptyPole")}
        count={pole.members.length}
      >
        {pole.members.map((member) => (
          <PlayerCard key={member.id} player={member} parentSlug={pole.slug} />
        ))}
      </DetailLayout>
    );
  }

  notFound();
}

function DetailLayout({
  eyebrow,
  title,
  description,
  emptyLabel,
  count,
  children,
  backLabel,
  locale,
  after,
}: {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  emptyLabel: string;
  count: number;
  children: React.ReactNode;
  // Reçus en props plutôt que lus par un hook : sous `force-static` il n'y a
  // pas de requête, donc aucun contexte de langue à l'intérieur d'un
  // sous-composant. Ils viennent du corps de la page, qui a la langue.
  backLabel: string;
  locale: string;
  /** Contenu additionnel sous les membres (ex. les matchs d'un roster). */
  after?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <Link
        href="/equipes"
        locale={locale}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> {backLabel}
      </Link>

      <header className="mb-14 mt-6 text-center">
        {eyebrow && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(220,37,21,0.4)] sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
            {description}
          </p>
        )}
      </header>

      {count === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
      )}

      {after}
    </div>
  );
}

/**
 * Section « Matchs » d'un roster (à venir + résultats récents), affichée sous
 * ses membres. Rendue vide (null) si le roster n'a aucun match — on ne pollue
 * pas la page d'une équipe qui n'a pas encore joué.
 */
async function RosterMatchs({ rosterId, locale }: { rosterId: string; locale: string }) {
  const { upcoming, results } = await getRosterMatchBoards(rosterId);
  const recentResults = results.slice(0, 4); // le calendrier complet est sur /calendrier
  if (upcoming.length + recentResults.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "calendrier" });
  const tEquipe = await getTranslations({ locale, namespace: "equipeDetail" });
  const labels: MatchLabels = {
    vs: t("vs"),
    watch: t("watch"),
    newTab: t("newTab"),
    cancelled: t("cancelled"),
    result: { win: t("win"), loss: t("loss"), draw: t("draw") },
  };
  const subHead = "mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400";

  return (
    <section aria-labelledby="roster-matchs" className="mt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2
          id="roster-matchs"
          className="font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {tEquipe("matchsHeading")}
        </h2>
        <Link
          href="/calendrier"
          locale={locale}
          className="shrink-0 text-sm font-semibold text-xbz-cyan hover:underline"
        >
          {tEquipe("allMatchs")}
        </Link>
      </div>

      {upcoming.length > 0 && (
        <>
          <h3 className={subHead}>{t("upcomingHeading")}</h3>
          <ul className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} locale={locale} labels={labels} />
            ))}
          </ul>
        </>
      )}

      {recentResults.length > 0 && (
        <>
          <h3 className={subHead}>{t("resultsHeading")}</h3>
          <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {recentResults.map((match) => (
              <MatchCard key={match.id} match={match} locale={locale} labels={labels} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
