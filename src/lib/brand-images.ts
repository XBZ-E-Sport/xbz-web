// Images de la marque en IMPORT STATIQUE (fichiers de /public, inchangés).
//
// Servies via `/public`, leurs versions optimisées repartaient avec
// `Cache-Control: max-age=0` : le navigateur revalidait le logo à chaque page
// (un aller-retour de plus). Importées, elles portent un hash de contenu dans
// leur adresse et sont mises en cache un an (`immutable`). Les fichiers restent
// aussi dans /public : le JSON-LD, le manifeste et les bannières Open Graph
// les désignent par leur URL publique.

import corbeau from "../../public/corbeau.png";
import logoLight from "../../public/logo-xbz-light.png";
import logoWide from "../../public/logo-xbz-wide.png";

export { corbeau, logoLight, logoWide };
