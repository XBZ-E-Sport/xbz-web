import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site";
import CurrentYear from "@/components/CurrentYear";

// Liens repris de la navigation principale (mêmes pages).
const navLinks = [
  { href: "/le-club", key: "leClub" },
  { href: "/presentation", key: "presentation" },
  { href: "/equipes", key: "equipes" },
  { href: "/actualite", key: "actualite" },
  { href: "/boutique", key: "boutique" },
  { href: "/recrutement", key: "recrutement" },
] as const;

const infoLinks = [
  { href: "/recrutement", key: "joinUs" },
  { href: "/support", key: "supportContact" },
  { href: "/mentions-legales", key: "legal" },
  { href: "/confidentialite", key: "privacy" },
] as const;

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

// `inline-block py-1` : la zone cliquable passe de 16 px à 24 px de haut, le
// minimum du critère « Target Size (Minimum) » du WCAG 2.2 AA. Le texte ne
// bouge pas d'un pixel — c'est la surface tactile qui grandit, au bénéfice de
// tous ceux qui visent mal : gros doigts, écran dans le métro, tremblements.
const linkCls = "inline-block py-1 text-neutral-400 transition hover:text-xbz-cyan";
const headingCls =
  "mb-4 font-display text-sm font-bold uppercase tracking-[2px] text-neutral-300";

/**
 * Le pied de page est un composant SERVEUR : il ne voit pas le contexte de
 * langue du provider client. La langue lui est donc passée explicitement — sans
 * quoi, sur une page prérendue (`force-static`), il repartirait en français et
 * pointerait vers `/fr/…` depuis une page anglaise.
 */
export default async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tSite = await getTranslations({ locale, namespace: "site" });
  // Année du build/requête (corrigée côté client par <CurrentYear/>).
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-20 border-t border-white/10 bg-[rgba(10,10,14,0.6)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marque */}
        <div className="lg:col-span-2">
          <Link
            href="/"
            locale={locale}
            aria-label={tNav("homeAria")}
            className="inline-flex items-center gap-3"
          >
            <Image src="/logo-xbz.png" alt="" width={40} height={40} className="h-10 w-10" />
            <span className="font-display text-lg font-black uppercase tracking-wide text-white">
              {siteConfig.name}
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
            {tSite("description").replace(`${siteConfig.name} — `, "")}
          </p>
          {DISCORD_URL && (
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              {tNav("joinDiscord")}
              <span className="sr-only">{tNav("newTab")}</span>
            </a>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label={t("footerNav")}>
          <h2 className={headingCls}>{t("navigation")}</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} locale={locale} className={linkCls}>
                  {tNav(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Infos & légal */}
        <div>
          <h2 className={headingCls}>{t("infos")}</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {infoLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} locale={locale} className={linkCls}>
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Barre du bas */}
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-neutral-400 sm:flex-row">
          <p>
            © <CurrentYear initial={year} /> {siteConfig.name}. {t("rights")}
          </p>
          <p className="text-neutral-400">{t("signature")}</p>
        </div>
      </div>
    </footer>
  );
}
