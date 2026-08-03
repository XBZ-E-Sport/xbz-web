import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leClub" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/le-club",
    locale,
  });
}

// Rendu statique explicite.
//
// Depuis le passage sous le segment `[locale]`, la racine de l'app vit dans un
// segment dynamique : Next n'infère plus le prérendu tout seul et bascule la
// route en rendu à la demande. Cette page n'a aucune donnée liée à la requête
// (pas de base, pas de cookie, pas d'en-tête) — on rétablit donc le prérendu au
// build, comme avant l'i18n. `generateStaticParams` du layout fournit les deux
// langues, donc les deux versions sont générées.
export const dynamic = "force-static";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

// Les clés pointent vers `leClub.poles.*` / `leClub.sections.*` : l'ordre et les
// icônes restent ici (présentation), les textes vivent dans les fichiers de langue.
const poles = ["esport", "communaute", "creation", "staff"] as const;
const poleIcons: Record<(typeof poles)[number], string> = {
  esport: "🎮",
  communaute: "💬",
  creation: "🎬",
  staff: "🛡️",
};

const sections = [
  { href: "/presentation", key: "presentation", icon: "👑" },
  { href: "/equipes", key: "equipes", icon: "🎮" },
  { href: "/recrutement", key: "recrutement", icon: "📝" },
  { href: "/actualite", key: "actualite", icon: "📰" },
  { href: "/boutique", key: "boutique", icon: "🛒" },
  { href: "/support", key: "support", icon: "✉️" },
] as const;

export default async function LeClubPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Locale passée EXPLICITEMENT : sous `force-static` il n'y a pas de requête,
  // donc pas de langue « ambiante » — `getTranslations()` sans argument
  // retomberait sur le français et rendrait la page anglaise en français.
  const t = await getTranslations({ locale, namespace: "leClub" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("leClub")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t("intro")}
        </p>
      </header>

      <section aria-labelledby="poles-heading" className="mb-16">
        <h2
          id="poles-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("polesHeading")}
        </h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {poles.map((key) => (
            <li key={key} className="card-xbz p-6 text-center">
              <span aria-hidden="true" className="text-3xl leading-none">
                {poleIcons[key]}
              </span>
              <h3 className="mt-3 font-display text-lg text-xbz-blue">
                {t(`poles.${key}.title`)}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                {t(`poles.${key}.text`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="explorer-heading" className="mb-16">
        <h2
          id="explorer-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("exploreHeading")}
        </h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                locale={locale}
                className="card-xbz group flex h-full items-start gap-4 p-6 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1"
              >
                <span aria-hidden="true" className="text-3xl leading-none">
                  {s.icon}
                </span>
                <div className="flex-1">
                  <h3 className="flex items-center gap-1 font-display text-lg text-xbz-blue">
                    {tNav(s.key)}
                    <span
                      aria-hidden="true"
                      className="text-xbz-cyan transition-transform duration-300 motion-safe:group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                    {t(`sections.${s.key}`)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="communaute-heading">
        <div className="card-xbz p-8 text-center sm:p-10">
          <h2 id="communaute-heading" className="font-display text-2xl font-bold sm:text-3xl">
            {t("communityTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-300">{t("communityText")}</p>
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
      </section>
    </div>
  );
}
