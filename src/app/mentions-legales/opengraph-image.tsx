import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Mentions légales — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Légal",
    title: "Mentions légales",
    subtitle: "Éditeur, hébergement et informations légales.",
    accent: "#c9d6e3",
    accentTo: "#8fb8d6",
  });
}
