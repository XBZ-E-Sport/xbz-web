import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Présentation — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Présentation",
    title: "Notre structure",
    subtitle: "Valeurs, ambitions et organisation de XBZ Esport.",
  });
}
