// Choix de la variante linguistique des champs venant de la base.
//
// Le schéma garde le français dans la colonne d'origine (`description`) et
// l'anglais dans une colonne jumelle (`description_en`). Rien n'oblige le staff
// à remplir l'anglais : une colonne vide fait simplement retomber la page sur le
// français. Un contenu non traduit s'affiche donc en français plutôt que de
// laisser un blanc — c'est le seul comportement acceptable pour un site public.

/** `true` si la valeur contient autre chose que des espaces. */
function filled(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Texte d'un champ traduisible, avec repli sur le français.
 *
 * Renvoie `null` si les deux variantes sont vides, pour que l'appelant puisse
 * masquer le bloc entier plutôt que d'afficher une chaîne vide.
 */
export function localizedText(
  fr: string | null | undefined,
  en: string | null | undefined,
  locale: string,
): string | null {
  if (locale !== "fr" && filled(en)) return en;
  return filled(fr) ? fr : null;
}

/**
 * Idem pour une liste (palmarès, paragraphes d'article).
 *
 * Le repli joue sur la LISTE ENTIÈRE, pas ligne à ligne : une traduction
 * partielle mélangerait les deux langues dans un même bloc. Une liste anglaise
 * non vide gagne, sinon on affiche la française telle quelle.
 */
export function localizedList(
  fr: string[] | null | undefined,
  en: string[] | null | undefined,
  locale: string,
): string[] {
  if (locale !== "fr") {
    const translated = (en ?? []).filter(filled);
    if (translated.length > 0) return translated;
  }
  return (fr ?? []).filter(filled);
}

// --- Pays ------------------------------------------------------------------

// Une instance par langue : `Intl.DisplayNames` est coûteux à construire et on
// l'appelle une fois par joueur affiché.
const displayNames = new Map<string, Intl.DisplayNames>();

function regionNames(locale: string): Intl.DisplayNames {
  let dn = displayNames.get(locale);
  if (!dn) {
    // `fallback: "none"` → `of()` renvoie `undefined` sur un code non attribué,
    // au lieu de recracher le code lui-même. On sait donc distinguer « pays
    // inconnu » de « pays dont le nom est le code » sans comparer des chaînes.
    dn = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
    displayNames.set(locale, dn);
  }
  return dn;
}

// `ZZ` est un code CLDR valide qui signifie « région inconnue » : Intl lui donne
// un vrai nom (« Unknown Region »), qu'on ne veut évidemment pas afficher.
const UNKNOWN_REGIONS = new Set(["ZZ"]);

/**
 * Nom du pays dans la langue demandée, dérivé du code ISO alpha-2.
 *
 * Aucune saisie à prévoir : `pays_code` est déjà en base pour le drapeau, et
 * `Intl` connaît les 249 pays dans toutes les langues. Le champ libre `pays`
 * ne sert que de repli quand le code manque ou n'est pas reconnu.
 */
export function countryName(
  code: string | null | undefined,
  fallback: string | null | undefined,
  locale: string,
): string | null {
  if (code && /^[A-Za-z]{2}$/.test(code)) {
    const cc = code.toUpperCase();
    if (!UNKNOWN_REGIONS.has(cc)) {
      const name = regionNames(locale).of(cc);
      if (name) return name;
    }
  }
  return filled(fallback) ? fallback : null;
}
