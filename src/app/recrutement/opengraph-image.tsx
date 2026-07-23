import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Recrutement — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Recrutement",
    title: "Rejoins XBZ",
    subtitle: "Postes ouverts en équipe compétitive et au staff.",
    accent: "#00e0ff",
    accentTo: "#00bfff",
  });
}
