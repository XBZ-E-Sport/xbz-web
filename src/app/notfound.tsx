import Link from "next/link";

export const metadata = {
  title: "Page introuvable — XBZ Esport",
  description: "Cette page n'existe pas ou a été déplacée.",
};

export default function NotFound() {
  return (
    <section
      aria-labelledby="nf-title"
      className="relative z-10 flex min-h-[70svh] flex-col items-center justify-center gap-6 px-6 py-24 text-center"
    >
      <p
        aria-hidden="true"
        className="font-display text-7xl font-black tracking-widest text-xbz-blue drop-shadow-[0_0_35px_rgba(0,102,255,0.5)] sm:text-8xl"
      >
        404
      </p>
      <h1 id="nf-title" className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
        Page introuvable
      </h1>
      <p className="max-w-md text-balance leading-relaxed text-neutral-300">
        Oups, cette page n’existe pas ou a été déplacée. Reviens en terrain connu pour continuer
        ta visite.
      </p>
      <div className="mt-2 flex w-full max-w-md flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
        >
          Retour à l’accueil
        </Link>
        <Link
          href="/le-club"
          className="rounded-xl border border-white/25 px-7 py-3.5 text-center font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
        >
          Découvrir le club
        </Link>
      </div>
    </section>
  );
}
