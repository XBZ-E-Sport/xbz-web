import Image from "next/image";
import Link from "next/link";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

export default function Home() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative z-10 flex min-h-svh flex-col items-center justify-center gap-7 px-6 py-28 text-center"
    >
      {/* Logo décoratif : le nom du club est déjà porté par le <h1> juste après */}
      <Image
        src="/logo-xbz.png"
        alt=""
        width={208}
        height={208}
        preload
        className="h-32 w-32 drop-shadow-[0_0_25px_rgba(0,102,255,0.45)] sm:h-48 sm:w-48"
      />

      <h1
        id="hero-title"
        className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_35px_rgba(0,102,255,0.55)] sm:text-6xl sm:tracking-widest md:text-7xl"
      >
        XBZ Esport
      </h1>

      <p className="max-w-xl text-balance text-lg leading-relaxed text-neutral-300 sm:text-xl">
        Structure esport compétitive sur{" "}
        <strong className="font-semibold text-white">Rocket League</strong>. Rejoins une
        équipe motivée, sérieuse et ambitieuse.
      </p>

      {/* Statut recrutement */}
      <p className="inline-flex items-center gap-2 rounded-full border border-xbz-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-semibold text-xbz-cyan">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-xbz-cyan motion-safe:animate-pulse"
        />
        Recrutement ouvert
      </p>

      {/* Appels à l'action */}
      <div className="mt-2 flex w-full max-w-md flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-[#5865F2] px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
        >
          Rejoindre le Discord
          <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
        </a>
        <Link
          href="/recrutement"
          className="rounded-xl border border-white/25 px-7 py-3.5 text-center font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
        >
          Nous rejoindre
        </Link>
      </div>
    </section>
  );
}
