import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Politique de confidentialité — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Légal",
    title: "Confidentialité",
    subtitle: "Traitement et protection de tes données (RGPD).",
    accent: "#c9d6e3",
    accentTo: "#8fb8d6",
  });
}
