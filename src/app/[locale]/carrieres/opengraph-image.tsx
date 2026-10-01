import { pageOgRoute } from "@/lib/og-routes";

// Bannière de partage de la page. Identifiant versionné (l'adresse change à
// chaque déploiement : Discord, X… ne gardent plus une ancienne bannière) et
// texte alternatif traduit : voir src/lib/og-routes.ts.
// Textes fixes : rendue à la première demande dans chaque langue, puis servie
// depuis le cache jusqu'au déploiement suivant (`force-static`).
export const dynamic = "force-static";

const route = pageOgRoute("carrieres");
export const generateImageMetadata = route.generateImageMetadata;
export default route.Image;
