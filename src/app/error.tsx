"use client";

import Link from "next/link";
import { useEffect } from "react";

// Frontière d'erreur au niveau de l'app : capture les erreurs de rendu/serveur
// des pages (ex. panne Supabase) et affiche un écran brandé au lieu du crash brut.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative z-10 mx-auto flex min-h-[70svh] max-w-lg flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">Oups</p>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-4xl">
        Une erreur est survenue
      </h1>
      <p className="mt-4 leading-relaxed text-neutral-300">
        Quelque chose s’est mal passé de notre côté. Réessaie dans un instant — si le problème
        persiste, préviens-nous sur Discord.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="rounded-xl bg-xbz-blue px-7 py-3 font-bold text-white transition hover:brightness-110 hover:cursor-pointer motion-safe:hover:-translate-y-0.5"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/25 px-7 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5"
        >
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
