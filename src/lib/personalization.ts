// Personnalisation d'un article (nom et numéro au dos d'un maillot) : les règles,
// partagées par le navigateur (fiche produit, panier) et par le serveur (route de
// paiement). Aucune dépendance serveur ni navigateur : importable partout.
//
// Un article personnalisé à la demande du client est exclu du droit de rétractation
// (article L.221-28, 3° du Code de la consommation) : la fiche produit et le panier
// le disent AVANT la commande (article L.221-5).
//
// La personnalisation est un interrupteur PAR PRODUIT (colonne `products.personalizable`,
// réglée dans le back-office) : éteinte, rien de ce qui suit n'est proposé ni accepté.

/** Caractères au plus dans le nom imprimé (même borne qu'en base). */
export const PRINT_NAME_MAX = 12;

/** Ce qui est imprimé : un nom, un numéro, ou les deux (au moins l'un des deux). */
export type Print = { name?: string; number?: string };

// Lettres latines (accents compris), espace, apostrophe, tiret, point : ce que
// l'atelier sait imprimer. Rien d'autre (pas de chiffres dans le nom, pas de symboles).
const NAME_CHARS = /^[\p{Script=Latin}][\p{Script=Latin} '.-]*$/u;

/**
 * Nom imprimé, mis en forme : majuscules, espaces superflus retirés, apostrophe
 * droite. `null` s'il est vide, trop long ou contient autre chose que des lettres.
 */
export function normalizePrintName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/’/g, "'")
    .toLocaleUpperCase("fr");
  if (name === "" || [...name].length > PRINT_NAME_MAX) return null;
  return NAME_CHARS.test(name) ? name : null;
}

/** Numéro imprimé : 0 à 99, sans zéro de tête (« 07 » devient « 7 »). `null` sinon. */
export function normalizePrintNumber(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isInteger(raw)) raw = String(raw);
  if (typeof raw !== "string") return null;
  const digits = raw.trim();
  if (!/^[0-9]{1,2}$/.test(digits)) return null;
  return String(Number(digits));
}

/**
 * Personnalisation reçue (navigateur ou serveur).
 *  - `undefined` : aucune personnalisation (champ absent ou vide) ;
 *  - `null`      : demandée mais invalide : à REFUSER, jamais corriger en silence ;
 *  - un `Print`  : valide et mis en forme.
 */
export function parsePrint(raw: unknown): Print | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const { name, number } = raw as Record<string, unknown>;
  const hasName = name !== undefined && name !== null && !(typeof name === "string" && name.trim() === "");
  const hasNumber = number !== undefined && number !== null && !(typeof number === "string" && number.trim() === "");
  if (!hasName && !hasNumber) return undefined;
  const out: Print = {};
  if (hasName) {
    const n = normalizePrintName(name);
    if (n === null) return null;
    out.name = n;
  }
  if (hasNumber) {
    const n = normalizePrintNumber(number);
    if (n === null) return null;
    out.number = n;
  }
  return out;
}

/** Identité d'une personnalisation dans le panier (deux textes différents = deux articles). */
export function printKey(print: Print | undefined): string {
  return print ? `${print.name ?? ""}|${print.number ?? ""}` : "";
}

/** « MARTIN · n° 10 », « MARTIN » ou « n° 10 » : `numberLabel` est le « n° » de la langue. */
export function printText(print: Print, numberLabel: string): string {
  const parts: string[] = [];
  if (print.name) parts.push(print.name);
  if (print.number !== undefined) parts.push(`${numberLabel} ${print.number}`);
  return parts.join(" · ");
}
