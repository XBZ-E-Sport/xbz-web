// Petits utilitaires de texte, sans dépendance (utilisables partout).

/**
 * Coupe proprement un texte trop long (les titres/descriptions viennent de la
 * BDD) : sur une fin de mot si possible, sans ponctuation orpheline avant « … ».
 */
export function clamp(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const head = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,;:.!?·–—-]+$/u, "")}…`;
}

/** Espaces, retours à la ligne et tabulations ramenés à une seule espace. */
export function squash(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
