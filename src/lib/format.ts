// Helpers d'affichage partagés (client-safe : n'importe que des types).
import type { ArticleCategory } from "@/lib/actualite";

/** Date ISO → format long français, fuseau Paris (ex: "14 juillet 2026"). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/** Couleur du badge selon la catégorie d'article (source unique). */
export const articleCategoryStyles: Record<ArticleCategory, string> = {
  Compétition: "bg-xbz-blue/15 text-[#7fc8ff]",
  Recrutement: "bg-[rgba(0,200,255,0.15)] text-[#7fe6ff]",
  Annonce: "bg-white/10 text-white",
  Communauté: "bg-[rgba(88,101,242,0.18)] text-[#b6bdff]",
  Création: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff]",
};
