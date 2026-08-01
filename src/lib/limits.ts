// Longueurs maximales des champs des formulaires publics.
//
// Source de vérité UNIQUE, partagée client + serveur :
//  - les composants de formulaire en font des attributs `maxLength` (confort) ;
//  - les routes API les revalident (sécurité — le navigateur n'est jamais cru).
//
// Sans ce plafond, un champ libre non borné part tel quel en base ET vers le
// bot Discord (qui refuse un embed > 6000 caractères).
export const FIELD_MAX = {
  // Recrutement
  nom: 80,
  pseudo: 40,
  discord: 40,
  pays: 60,
  jeu: 40,
  roster: 60,
  rltracker: 300,
  exp: 4000,
  motiv: 4000,
  // Support
  email: 120,
  sujet: 60,
  message: 4000,
} as const;

export type FieldName = keyof typeof FIELD_MAX;

/** Libellés utilisateur, pour un message d'erreur compréhensible. */
export const FIELD_LABEL: Record<FieldName, string> = {
  nom: "Nom / Prénom",
  pseudo: "Pseudo",
  discord: "Discord",
  pays: "Pays de résidence",
  jeu: "Jeu",
  roster: "Roster souhaité",
  rltracker: "Lien RL Tracker",
  exp: "Expérience",
  motiv: "Motivation",
  email: "Email",
  sujet: "Sujet",
  message: "Message",
};

/**
 * Renvoie le nom du premier champ dépassant sa limite, sinon `null`.
 * Les valeurs non-string (absentes, nombres) sont ignorées : la présence des
 * champs obligatoires est vérifiée séparément par chaque route.
 */
export function findTooLong(values: Partial<Record<FieldName, unknown>>): FieldName | null {
  for (const [key, value] of Object.entries(values) as [FieldName, unknown][]) {
    if (typeof value === "string" && value.length > FIELD_MAX[key]) return key;
  }
  return null;
}

/** Message d'erreur prêt à renvoyer (422) pour un champ trop long. */
export function tooLongMessage(field: FieldName): string {
  return `Le champ « ${FIELD_LABEL[field]} » est trop long (${FIELD_MAX[field]} caractères maximum).`;
}
