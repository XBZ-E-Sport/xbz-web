// Articles que la boutique propose personnalisés (nom, numéro…). Un article
// personnalisé à la demande du client est EXCLU du droit de rétractation (article
// L.221-28, 3° du Code de la consommation) : la fiche produit doit le dire avant la
// commande (article L.221-5).
//
// Liste provisoire par fiche (slug) : elle sera remplacée par un réglage porté par le
// produit lui-même quand la personnalisation sera saisissable à la commande.
export const PERSONALIZABLE_SLUGS: readonly string[] = ["maillot-officiel"];

export function isPersonalizable(slug: string): boolean {
  return PERSONALIZABLE_SLUGS.includes(slug);
}
