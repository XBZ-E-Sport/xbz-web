import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getStructureStats } from "@/lib/equipes";
import { pageMetadata } from "@/lib/site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "presentation" });
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/presentation",
    locale,
  });
}

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

// Stats lues en base (slots dynamiques).
export const dynamic = "force-dynamic";

// Icônes ici, textes dans les fichiers de langue (`presentation.values.*`).
const values = [
  { key: "competition", icon: "🏆" },
  { key: "teamSpirit", icon: "🤝" },
  { key: "progression", icon: "📈" },
  { key: "ambition", icon: "🎯" },
] as const;

export default async function PresentationPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("presentation");
  const tHome = await getTranslations("home");
  const tNav = await getTranslations("nav");

  const structure = await getStructureStats();
  const stats = [
    { value: structure.teams, label: tHome("statsTeams") },
    { value: structure.poles, label: tHome("statsPoles") },
    { value: structure.members, label: tHome("statsMembers") },
    { value: structure.openSlots, label: tHome("statsOpenSlots") },
  ];
  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-32">
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          {tNav("presentation")}
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          {t.rich("intro", {
            game: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
          })}
        </p>
      </header>

      <section aria-labelledby="pitch-heading" className="mb-16">
        <div className="card-xbz p-8 sm:p-10">
          <h2 id="pitch-heading" className="mb-5 font-display text-2xl font-bold sm:text-3xl">
            {t("pitchHeading")}
          </h2>
          <div className="space-y-5 leading-relaxed text-neutral-300">
            <p>{t("pitch1")}</p>
            <p>
              {t.rich("pitch2", {
                game: (chunks) => <strong className="text-white">{chunks}</strong>,
              })}
            </p>
            <p>{t("pitch3")}</p>
            <p>{t("pitch4")}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="chiffres-heading" className="mb-16">
        <h2
          id="chiffres-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("statsHeading")}
        </h2>
        {/* Liste de description (clé/valeur) : sémantiquement correct pour des
            stats, et évite que les grands nombres soient pris pour des titres. */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card-xbz flex flex-col-reverse gap-2 p-6 text-center">
              <dt className="text-sm text-neutral-400">{s.label}</dt>
              <dd className="font-display text-4xl font-black text-xbz-cyan">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="valeurs-heading" className="mb-16">
        <h2
          id="valeurs-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          {t("valuesHeading")}
        </h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {values.map((v) => (
            <li key={v.key} className="card-xbz flex gap-4 p-6">
              <span aria-hidden="true" className="text-3xl leading-none">
                {v.icon}
              </span>
              <div>
                <h3 className="font-display text-lg text-xbz-blue">
                  {t(`values.${v.key}.title`)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                  {t(`values.${v.key}.text`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cta-heading">
        <div className="card-xbz p-8 text-center sm:p-10">
          <h2 id="cta-heading" className="font-display text-2xl font-bold sm:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-300">{t("ctaText")}</p>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#5865F2] px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              {tNav("joinDiscord")}
              <span className="sr-only">{tNav("newTab")}</span>
            </a>
            <Link
              href="/recrutement"
              className="rounded-xl border border-white/25 px-7 py-3.5 text-center font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
            >
              {tHome("joinUs")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
