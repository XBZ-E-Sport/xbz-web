import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Support — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Support",
    title: "Besoin d’aide ?",
    subtitle: "Contacte le staff via Discord, email ou formulaire.",
  });
}
