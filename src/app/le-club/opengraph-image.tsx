import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Le club — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Le club",
    title: "Le club XBZ",
    subtitle: "Esport, staff & communauté : découvre la structure.",
  });
}
