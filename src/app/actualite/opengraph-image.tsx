import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Actualité — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Actualité",
    title: "Les news du club",
    subtitle: "Résultats, recrutement et annonces de la structure.",
  });
}
