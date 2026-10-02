"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Photos d'un produit : une grande, et des vignettes pour passer de l'une à
 * l'autre. Sans photo (ou si elle ne charge pas), l'emoji de repli du produit,
 * comme sur les cartes de la boutique.
 */
export default function ProductGallery({ images, name, icon }: { images: string[]; name: string; icon: string }) {
  const t = useTranslations("product");
  const [index, setIndex] = useState(0);
  // Photo morte (supprimée du bucket, URL erronée) : on la retire de la galerie
  // plutôt que de laisser un cadre vide.
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const photos = images.filter((src) => !failed.has(src));
  const current = photos[Math.min(index, photos.length - 1)];
  const total = photos.length;

  return (
    <section aria-label={t("photos")} className="flex flex-col gap-3">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-xbz-blue/20 to-xbz-cyan/10">
        {current ? (
          <Image
            key={current}
            src={current}
            alt={t("photoAlt", { name, n: photos.indexOf(current) + 1, total })}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
            // Élément principal de la page : chargé tout de suite.
            preload={index === 0}
            onError={() => setFailed((f) => new Set(f).add(current))}
          />
        ) : (
          <span aria-hidden="true" className="text-8xl">
            {icon || "🛒"}
          </span>
        )}
      </div>

      {total > 1 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((src, i) => {
            const selected = src === current;
            return (
              <li key={src}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t("showPhoto", { n: i + 1, total })}
                  aria-current={selected || undefined}
                  className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 transition hover:cursor-pointer ${
                    selected ? "border-xbz-cyan" : "border-white/15 hover:border-white/50"
                  }`}
                >
                  <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
