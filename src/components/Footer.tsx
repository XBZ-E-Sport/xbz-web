import Link from "next/link";
import Image from "next/image";

import { siteConfig } from "@/lib/site";
import CurrentYear from "@/components/CurrentYear";

// Liens repris de la navigation principale (mêmes pages).
const navLinks = [
  { href: "/le-club", label: "Le club" },
  { href: "/presentation", label: "Présentation" },
  { href: "/equipes", label: "Équipes" },
  { href: "/actualite", label: "Actualité" },
  { href: "/boutique", label: "Boutique" },
  { href: "/recrutement", label: "Recrutement" },
];

const infoLinks = [
  { href: "/recrutement", label: "Nous rejoindre" },
  { href: "/support", label: "Support & contact" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
];

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

const linkCls = "text-neutral-400 transition hover:text-xbz-cyan";
const headingCls =
  "mb-4 font-display text-sm font-bold uppercase tracking-[2px] text-neutral-300";

export default function Footer() {
  // Année du build/requête (corrigée côté client par <CurrentYear/>).
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-20 border-t border-white/10 bg-[rgba(10,10,14,0.6)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marque */}
        <div className="lg:col-span-2">
          <Link href="/" aria-label={`${siteConfig.name} — Accueil`} className="inline-flex items-center gap-3">
            <Image src="/logo-xbz.png" alt="" width={40} height={40} className="h-10 w-10" />
            <span className="font-display text-lg font-black uppercase tracking-wide text-white">
              {siteConfig.name}
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
            Structure esport compétitive sur Rocket League. Rejoins une équipe motivée, sérieuse
            et ambitieuse.
          </p>
          {DISCORD_URL && (
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              Rejoindre le Discord
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Liens du pied de page">
          <h2 className={headingCls}>Navigation</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Infos & légal */}
        <div>
          <h2 className={headingCls}>Infos</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {infoLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
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
            © <CurrentYear initial={year} /> {siteConfig.name}. Tous droits réservés.
          </p>
          <p className="text-neutral-400">Structure esport Rocket League 💙</p>
        </div>
      </div>
    </footer>
  );
}
