// Couche d'accès à la galerie médias.
// Source : table Supabase `medias` (lecture publique des médias actifs, via RLS
// active = true). Photos et vidéos (lien YouTube/Twitch), filtrables par catégorie.

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "@/lib/cache";

export const mediaTypes = ["photo", "video"] as const;
export type MediaType = (typeof mediaTypes)[number];

// Clés stables (ASCII) ; le libellé affiché est traduit (namespace mediaCategories).
export const mediaCategories = ["events", "matches", "creation", "backstage"] as const;
export type MediaCategory = (typeof mediaCategories)[number];

export type Media = {
  id: string;
  type: MediaType;
  title: string;
  category: MediaCategory;
  image: string | null;
  videoUrl: string | null;
};

const MEDIA_COLS = "id, type, title, category, image, video_url";

function normalizeType(value: string): MediaType {
  return (mediaTypes as readonly string[]).includes(value) ? (value as MediaType) : "photo";
}

function normalizeCategory(value: string): MediaCategory {
  return (mediaCategories as readonly string[]).includes(value)
    ? (value as MediaCategory)
    : "events";
}

type MediaRow = {
  id: string;
  type: string;
  title: string | null;
  category: string;
  image: string | null;
  video_url: string | null;
};

function toMedia(row: MediaRow): Media {
  return {
    id: row.id,
    type: normalizeType(row.type),
    title: row.title ?? "",
    category: normalizeCategory(row.category),
    image: row.image ?? null,
    videoUrl: row.video_url ?? null,
  };
}

/** Lecture brute, mise en cache, ordonnée pour l'affichage. */
const fetchMedias = unstable_cache(
  async (): Promise<MediaRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("medias")
      .select(MEDIA_COLS)
      .eq("active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[medias] select:", error.message);
      return [];
    }
    return (data ?? []) as MediaRow[];
  },
  ["medias-list"],
  { tags: [CACHE_TAGS.medias], revalidate: CACHE_TTL_SECONDS },
);

/** Médias actifs, ordonnés pour l'affichage. */
export async function getMedias(): Promise<Media[]> {
  return (await fetchMedias()).map(toMedia);
}
