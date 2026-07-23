import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Boutique — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Boutique",
    title: "La boutique XBZ",
    subtitle: "Le merch officiel aux couleurs du club.",
    accent: "#c9a7ff",
    accentTo: "#8a5cff",
  });
}
