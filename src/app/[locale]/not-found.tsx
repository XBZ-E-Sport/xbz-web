import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <section
      aria-labelledby="nf-title"
      className="relative z-10 flex min-h-[70svh] flex-col items-center justify-center gap-6 px-6 py-24 text-center"
    >
      {/* Corbeau qui plonge — emblème de la marque, halo rouge derrière pour
          détacher la silhouette noire du fond. */}
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-56 w-56 sm:h-72 sm:w-72"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(220,37,21,0.5), rgba(220,37,21,0.24) 28%, rgba(220,37,21,0.07) 55%, transparent 75%)",
          }}
        />
        <Image
          src="/corbeau.png"
          alt=""
          width={573}
          height={374}
          priority
          className="relative h-24 w-auto drop-shadow-[0_0_20px_rgba(220,37,21,0.45)] motion-safe:animate-raven-float sm:h-32"
        />
      </div>

      <p
        aria-hidden="true"
        className="font-impact text-7xl font-bold tracking-widest text-xbz-blue glow-brand sm:text-8xl"
      >
        404
      </p>
      <h1 id="nf-title" className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
        {t("title")}
      </h1>
      <p className="max-w-md text-balance leading-relaxed text-neutral-300">{t("message")}</p>
      <div className="mt-2 flex w-full max-w-md flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="cut bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
        >
          {t("backHome")}
        </Link>
        <Link
          href="/le-club"
          className="rounded-[2px] border border-white/25 px-7 py-3.5 text-center font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
        >
          {t("discoverClub")}
        </Link>
      </div>
    </section>
  );
}
