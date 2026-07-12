"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/a-propos", label: "Qui sommes-nous" },
  { href: "/equipes", label: "Équipes" },
  { href: "/recrutement", label: "Recrutement" },
  { href: "/support", label: "Support" },
];

const DISCORD_URL = "https://discord.gg/w7s3rBPsZ6";

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-5 z-50 flex justify-center px-4">
      <nav className="flex max-w-[95%] items-center gap-2 overflow-x-auto rounded-2xl border border-xbz-blue/15 bg-[rgba(15,15,20,0.8)] px-3 py-2 backdrop-blur-xl">
        <Image src="/logo-xbz.png" alt="XBZ" width={32} height={32} className="shrink-0" />
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold tracking-wide transition ${
                active
                  ? "bg-linear-to-r from-xbz-blue to-xbz-cyan text-white shadow-[0_0_18px_rgba(0,102,255,0.4)]"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 shrink-0 rounded-lg bg-linear-to-r from-xbz-blue to-xbz-cyan px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
        >
          Discord
        </a>
      </nav>
    </header>
  );
}