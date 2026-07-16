"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/le-club", label: "Le club" },
  { href: "/presentation", label: "Présentation" },
  { href: "/equipes", label: "Équipes" },
  { href: "/actualite", label: "Actualité" },
  { href: "/boutique", label: "Boutique" },
  { href: "/recrutement", label: "Recrutement" },
  { href: "/support", label: "Support" },
];

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";

export default function Header() {
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

  const linkClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-bold tracking-wide transition ${
      active
        ? "bg-xbz-blue text-white shadow-[0_0_18px_rgba(0,102,255,0.45)]"
        : "text-neutral-200 hover:bg-white/5 hover:text-white"
    }`;

  // On ferme le menu au clic sur un lien (plutôt que via un effet sur pathname)
  const closeMenu = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav
        aria-label="Navigation principale"
        className="w-full max-w-5xl rounded-2xl border border-xbz-blue/15 bg-[rgba(15,15,20,0.85)] px-3 py-2 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Logo → accueil */}
          <Link
            href="/"
            onClick={closeMenu}
            aria-label="XBZ Esport — Accueil"
            aria-current={pathname === "/" ? "page" : undefined}
            className="flex shrink-0 items-center rounded-lg p-1"
          >
            <Image src="/logo-xbz.png" alt="" width={36} height={36} className="h-9 w-9" />
          </Link>

          {/* Navigation — bureau */}
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active)}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex shrink-0 items-center gap-2">
            {/* Discord — bureau */}
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 md:inline-block"
            >
              Discord
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>

            {/* Bouton menu — mobile */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden"
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
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Menu — mobile (toujours dans le DOM pour aria-controls) */}
        <ul
          id="menu-mobile"
          hidden={!open}
          className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2 md:hidden"
        >
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={closeMenu}
                  aria-current={active ? "page" : undefined}
                  className={`block ${linkClass(active)}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
          <li>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="mt-1 block rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-bold text-white"
            >
              Discord
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
