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

/**
 * Champ texte d'un corps JSON : la chaîne nettoyée, `""` si le champ est
 * absent, `null` si la valeur n'est PAS une chaîne (tableau, objet, nombre…).
 *
 * À appliquer AVANT `findTooLong` : `findTooLong` ignore les non-chaînes, et
 * `String(["A".repeat(200_000)])` redonne la chaîne entière — un tableau
 * contournait donc le plafond de longueur, jusqu'en base et au bot Discord.
 */
export function textField(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : null;
}

// --- Uploads d'images du back-office -----------------------------------------
// Une server action reçoit tout le formulaire dans UN corps de requête, et
// Vercel refuse tout corps au-delà de 4,5 Mo avant même d'appeler le site.
// 4 Mo par image laisse la marge des autres champs et de l'enveloppe
// multipart ; `serverActions.bodySizeLimit` (next.config.ts) est réglé en
// conséquence — sans lui, Next plafonnait à 1 Mo et une photo de téléphone
// échouait sur un « Échec de l'enregistrement » sans explication.
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** « 4 Mo », « 6,3 Mo » (espace insécable) : taille lisible pour un message. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${(Math.round(mb * 10) / 10).toLocaleString("fr-FR")}\u00a0Mo`;
}

/**
 * Premier fichier trop lourd d'un formulaire, en message prêt à afficher ;
 * `null` si tout passe. Vérifié côté navigateur AVANT l'envoi : au-delà, la
 * requête serait rejetée sans que le serveur puisse expliquer pourquoi.
 */
export function oversizedUpload(values: Iterable<FormDataEntryValue>): string | null {
  for (const value of values) {
    if (typeof value !== "string" && value.size > UPLOAD_MAX_BYTES) {
      return `« ${value.name} » est trop lourde (${formatMegabytes(value.size)}, ${formatMegabytes(UPLOAD_MAX_BYTES)} maximum). Réduis-la ou exporte-la en JPEG ou WebP.`;
    }
  }
  return null;
}

/** Message d'erreur prêt à renvoyer (422) pour un champ trop long. */
export function tooLongMessage(field: FieldName): string {
  return `Le champ « ${FIELD_LABEL[field]} » est trop long (${FIELD_MAX[field]} caractères maximum).`;
}
