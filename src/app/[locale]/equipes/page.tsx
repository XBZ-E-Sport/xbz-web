import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getEquipes, type Group, type GroupVariant } from "@/lib/equipes";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "equipes" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/equipes",
    locale,
  });
}

// Rendu statique régénéré en arrière-plan (ISR), au lieu d'un rendu serveur
// par visite. Les rosters et pôles venaient d'une lecture BDD par affichage.
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

const roleStyles: Record<GroupVariant, string> = {
  founder: "bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]",
  staff: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff] shadow-[0_0_12px_rgba(160,90,255,0.25)]",
  member: "bg-xbz-blue/10 text-[#7fc8ff] shadow-[0_0_12px_rgba(0,102,255,0.2)]",
  creative: "bg-[rgba(0,200,255,0.12)] text-[#7fe6ff] shadow-[0_0_12px_rgba(0,200,255,0.2)]",
};
const availabilityStyles = {
  open: "animate-pulse bg-linear-to-r from-[#7ad7ff] to-xbz-blue text-[#111] shadow-[0_0_25px_rgba(0,102,255,0.6)]",
  closed: "bg-linear-to-r from-xbz-orange to-xbz-dark-red text-[#111] shadow-[0_0_25px_rgba(255,15,16,0.6)]",
} as const;

function countOpen(groups: Group[]) {
  return groups.reduce((sum, g) => sum + Math.max(0, g.capacity - g.filled), 0);
}

// `t` et `locale` descendent en props plutôt que par un hook : sous
// `force-static` il n'y a pas de requête, donc aucun contexte de langue à
// l'intérieur d'un sous-composant. Ces fonctions vivent dans le même rendu
// serveur que la page, rien n'est sérialisé — le passage est gratuit.
type T = Awaited<ReturnType<typeof getTranslations<"equipes">>>;

function SectionHeading({ id, title, groups, t }: { id: string; title: string; groups: Group[]; t: T }) {
  const open = countOpen(groups);
  return (
    <h2
      id={id}
      className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
    >
      {title}
      <span className="ml-3 align-middle font-sans text-sm font-semibold tracking-normal text-xbz-cyan">
        {open > 0 ? t("openSlots", { count: open }) : t("full")}
      </span>
    </h2>
  );
}

function GroupCard({
  group,
  index = 0,
  t,
  locale,
}: {
  group: Group;
  index?: number;
  t: T;
  locale: string;
}) {
  const { filled, capacity } = group;
  const isFull = filled >= capacity;
  const pct = capacity > 0 ? Math.min(100, Math.max(0, (filled / capacity) * 100)) : 0;

  const slotsStyle = isFull
    ? "border-[rgba(255,15,16,0.4)] bg-[rgba(255,15,16,0.12)] text-[#ff7a7a]"
    : "border-xbz-blue/30 bg-xbz-blue/10 text-[#7fc8ff]";
  const badgeClass = "inline-block rounded-lg px-2.5 py-1 text-[11px] font-black";
  const slotsLabel = isFull
    ? t("slotsFullLabel", { capacity })
    : t("slotsLabel", { filled, capacity });

  return (
    <li
      className="card-xbz animate-fade-up group relative flex h-48 w-72 flex-col overflow-hidden p-6 transition duration-300 hover:scale-103 hover:border-xbz-blue/40"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {/* Toute la carte (roster comme pôle) est cliquable vers sa page détail,
            via un lien « étiré » (::after). Le bouton RECRUTEMENT reste cliquable
            indépendamment grâce à son z-10. */}
        <h3 className="font-display text-lg">
          <Link
            href={`/equipes/${group.slug}`}
            locale={locale}
            className="text-xbz-blue transition after:absolute after:inset-0 after:content-[''] group-hover:text-xbz-cyan"
          >
            {group.name}
          </Link>
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-bold ${slotsStyle}`}
          aria-label={slotsLabel}
        >
          {isFull && (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M12 2a4 4 0 0 0-4 4v3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm-2 7V6a2 2 0 1 1 4 0v3h-4Z" />
            </svg>
          )}
          {filled}/{capacity}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            isFull
              ? "bg-linear-to-r from-xbz-orange to-xbz-dark-red"
              : "bg-linear-to-r from-xbz-cyan to-xbz-blue"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {group.description && <p className="text-sm text-neutral-400">{group.description}</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${roleStyles[group.variant]}`}>
          {group.badge || t(`variants.${group.variant}`)}
        </span>
        {!group.fixed &&
          group.recrute &&
          (isFull ? (
            <span className={`${badgeClass} ${availabilityStyles.closed}`}>
              {t("recruitmentClosed")}
            </span>
          ) : (
            <Link
              href="/recrutement"
              locale={locale}
              aria-label={t("applyAria", { group: group.name })}
              className={`relative z-10 ${badgeClass} transition duration-300 hover:scale-103 hover:brightness-125 ${availabilityStyles.open}`}
            >
              {t("recruitmentOpen")}
            </Link>
          ))}
      </div>
    </li>
  );
}

export default async function EquipesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "equipes" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const { staff, esport } = await getEquipes(locale);

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("equipes")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      {staff.length > 0 && (
        <section aria-labelledby="staff-heading">
          <SectionHeading id="staff-heading" title={t("staffHeading")} groups={staff} t={t} />
          <ul className="flex flex-wrap justify-center gap-6">
            {staff.map((g, i) => (
              <GroupCard key={g.id} group={g} index={i} t={t} locale={locale} />
            ))}
          </ul>
        </section>
      )}

      {esport.length > 0 && (
        <section aria-labelledby="esport-heading" className="mt-20">
          <SectionHeading id="esport-heading" title={t("esportHeading")} groups={esport} t={t} />
          <ul className="flex flex-wrap justify-center gap-6">
            {esport.map((g, i) => (
              <GroupCard key={g.id} group={g} index={i} t={t} locale={locale} />
            ))}
          </ul>
        </section>
      )}

      {staff.length === 0 && esport.length === 0 && (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("empty")}</p>
      )}
    </section>
  );
}
