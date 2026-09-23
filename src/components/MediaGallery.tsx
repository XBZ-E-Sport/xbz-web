"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

// Import de TYPES uniquement (effacé au build) : la lib tire le client Supabase
// serveur, qu'on ne doit pas embarquer dans ce composant client. L'ordre des
// catégories est donc redéclaré ici (même liste que `mediaCategories`, gardée
// alignée par le type `MediaCategory`).
import type { Media, MediaCategory } from "@/lib/medias";

const CATEGORY_ORDER: MediaCategory[] = ["events", "matches", "creation", "backstage"];

type Filter = MediaCategory | "all";

/** Icône « lecture » posée sur la vignette d'une vidéo. */
function PlayBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/45"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-xl text-black">
        ▶
      </span>
    </span>
  );
}

/** Vignette (photo ou vidéo), fond clair de repli si l'image manque. */
function Thumb({ media }: { media: Media }) {
  return media.image ? (
    <Image
      src={media.image}
      alt={media.title || ""}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      className="object-cover transition duration-300 group-hover:scale-105"
    />
  ) : (
    <span aria-hidden="true" className="flex h-full items-center justify-center bg-white/5 text-4xl">
      {media.type === "video" ? "🎬" : "🖼️"}
    </span>
  );
}

export default function MediaGallery({ medias }: { medias: Media[] }) {
  const t = useTranslations("galerie");
  const tCat = useTranslations("mediaCategories");
  const [filter, setFilter] = useState<Filter>("all");
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Catégories réellement présentes (+ « Tous »), dans l'ordre de la constante.
  const filters = useMemo<Filter[]>(() => {
    const present = new Set(medias.map((m) => m.category));
    return ["all", ...CATEGORY_ORDER.filter((c) => present.has(c))];
  }, [medias]);

  const shown = filter === "all" ? medias : medias.filter((m) => m.category === filter);

  // Lightbox : Échap ferme, focus sur le bouton de fermeture à l'ouverture.
  useEffect(() => {
    if (!lightbox) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const chipBase =
    "rounded-[2px] px-4 py-1.5 text-sm font-semibold transition focus-visible:outline-none";
  const chipActive = "bg-linear-to-r from-xbz-cyan to-xbz-blue text-[#231a17]";
  const chipIdle = "border border-white/15 text-neutral-300 hover:border-white/40 hover:text-white";

  return (
    <>
      {/* Filtres par catégorie */}
      <div role="group" aria-label={t("filterAria")} className="mb-8 flex flex-wrap justify-center gap-2">
        {filters.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
              className={`${chipBase} ${active ? chipActive : chipIdle}`}
            >
              {f === "all" ? t("filterAll") : tCat(f)}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {t("resultCount", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">{t("emptyCategory")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((media) => (
            <li key={media.id}>
              {media.type === "video" && media.videoUrl ? (
                <a
                  href={media.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5"
                >
                  <Thumb media={media} />
                  <PlayBadge />
                  {media.title && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-3 py-2 text-xs font-semibold text-white">
                      {media.title}
                    </span>
                  )}
                  <span className="sr-only">
                    {media.title ? `${media.title} — ` : ""}
                    {t("openVideo")}
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setLightbox(media)}
                  aria-label={media.title || t("openPhoto")}
                  className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:cursor-pointer"
                >
                  <Thumb media={media} />
                  {media.title && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-3 py-2 text-left text-xs font-semibold text-white">
                      {media.title}
                    </span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Lightbox photo */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.title || t("openPhoto")}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={t("close")}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20 hover:cursor-pointer"
          >
            ✕
          </button>
          {/* Le clic sur l'image ne referme pas (stopPropagation) ; le fond, si. */}
          <figure onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-4xl">
            {lightbox.image && (
              <Image
                src={lightbox.image}
                alt={lightbox.title || ""}
                width={1280}
                height={960}
                className="h-auto max-h-[80vh] w-auto rounded-lg object-contain"
              />
            )}
            {lightbox.title && (
              <figcaption className="mt-3 text-center text-sm text-neutral-300">
                {lightbox.title}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </>
  );
}
