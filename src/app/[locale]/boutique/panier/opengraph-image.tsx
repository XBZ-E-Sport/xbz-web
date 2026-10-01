import { pageOgRoute } from "@/lib/og-routes";

// Partagé, un lien vers cette page montre la bannière de la boutique.
// Textes fixes : rendue à la première demande dans chaque langue, puis servie
// depuis le cache jusqu'au déploiement suivant (`force-static`).
export const dynamic = "force-static";

const route = pageOgRoute("boutique");
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
