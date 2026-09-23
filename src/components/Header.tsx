"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// `key` pointe vers le catalogue `nav` ; `href` reste l'URL française, que
// next-intl préfixe automatiquement en anglais (/en/…).
const links = [
  { href: "/le-club", key: "leClub" },
  { href: "/presentation", key: "presentation" },
  { href: "/equipes", key: "equipes" },
  { href: "/actualite", key: "actualite" },
  { href: "/boutique", key: "boutique" },
  { href: "/recrutement", key: "recrutement" },
  { href: "/support", key: "support" },
] as const;

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";

/** Petit logo Discord (inline, pour ne charger aucune image supplémentaire). */
function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="h-4 w-4">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export default function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Échap ferme le menu et redonne le focus au bouton
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Actif si on est sur la page OU une de ses sous-pages (ex. "Actualité" reste
  // actif sur /actualite/[slug]). Le lien "/" (logo) garde une égalité stricte.
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const closeMenu = () => setOpen(false);

  return (
    // Barre PLEINE LARGEUR ancrée en haut (plus le pavé flottant arrondi). Verre
    // dépoli charbon + fine bordure basse + liseré rouge en haut.
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgba(10,9,12,0.82)] backdrop-blur-xl">
      <div
        aria-hidden="true"
        className="h-px w-full bg-linear-to-r from-transparent via-xbz-blue/60 to-transparent"
      />
      <nav
        aria-label={t("mainNav")}
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        {/* Logo → accueil (marque XBZ + « ESPORT ») */}
        <Link
          href="/"
          onClick={closeMenu}
          aria-label={t("homeAria")}
          aria-current={pathname === "/" ? "page" : undefined}
          className="flex shrink-0 flex-col items-start leading-none"
        >
          <Image
            src="/logo-xbz-wide.png"
            alt="XBZ Esport"
            width={610}
            height={163}
            priority
            className="h-6 w-auto sm:h-7"
          />
        </Link>

        {/* Navigation — bureau (soulignement rouge animé sous l'item actif/survolé) */}
        <ul className="hidden items-center gap-0.5 min-[920px]:flex min-[1000px]:gap-1">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative px-3 py-2 text-sm font-bold tracking-wide transition-colors min-[1000px]:px-4 ${
                    active ? "text-white" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  {t(l.key)}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 -bottom-px h-0.75 origin-center rounded-full bg-xbz-blue shadow-[0_0_10px_rgba(220,37,21,0.6)] transition-transform duration-300 min-[1000px]:inset-x-4 ${
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Actions — langue + Discord + burger */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <span aria-hidden="true" className="hidden h-6 w-px bg-white/15 min-[920px]:block" />
          {/* Discord — blurple conservé (repère de la commu), comme décidé */}
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-[2px] bg-xbz-blue px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 min-[920px]:inline-flex"
          >
            <DiscordIcon />
            {t("discord")}
            <span className="sr-only">{t("newTab")}</span>
          </a>

          {/* Bouton menu — mobile */}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[2px] text-white hover:bg-white/10 min-[920px]:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-6 w-6"
            >
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* Menu — mobile (toujours dans le DOM pour aria-controls) */}
      <ul
        id="menu-mobile"
        hidden={!open}
        className="border-t border-white/10 bg-[rgba(10,9,12,0.97)] px-3 py-3 min-[920px]:hidden"
      >
        {links.map((l) => {
          const active = isActive(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={closeMenu}
                aria-current={active ? "page" : undefined}
                className={`block border-l-2 px-4 py-2.5 text-sm font-bold tracking-wide transition ${
                  active
                    ? "border-xbz-blue bg-white/5 text-white"
                    : "border-transparent text-neutral-300 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(l.key)}
              </Link>
            </li>
          );
        })}
        <li className="mt-2 px-1">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
            className="flex items-center justify-center gap-2 rounded-[2px] bg-xbz-blue px-4 py-2.5 text-sm font-bold text-white"
          >
            <DiscordIcon />
            {t("discord")}
            <span className="sr-only">{t("newTab")}</span>
          </a>
        </li>
      </ul>
    </header>
  );
}
