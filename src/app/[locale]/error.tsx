"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

// Frontière d'erreur au niveau de l'app : capture les erreurs de rendu/serveur
// des pages (ex. panne Supabase) et affiche un écran brandé au lieu du crash brut.
// Le layout (donc le contexte de langue) reste monté au-dessus : les traductions
// sont disponibles ici.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const tCommon = useTranslations("common");
  const tNotFound = useTranslations("notFound");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative z-10 mx-auto flex min-h-[70svh] max-w-lg flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
        {t("eyebrow")}
      </p>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-4xl">
        {tCommon("errorTitle")}
      </h1>
      <p className="mt-4 leading-relaxed text-neutral-300">{t("message")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="rounded-xl bg-xbz-blue px-7 py-3 font-bold text-white transition hover:brightness-110 hover:cursor-pointer motion-safe:hover:-translate-y-0.5"
        >
          {tCommon("retry")}
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/25 px-7 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5"
        >
          {tNotFound("backHome")}
        </Link>
      </div>
    </div>
  );
}
