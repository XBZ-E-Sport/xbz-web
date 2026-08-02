import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Équipes & Staff — XBZ Esport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Équipes & Staff",
    title: "Nos équipes",
    subtitle: "Rosters Rocket League et pôles staff de XBZ.",
  });
}
