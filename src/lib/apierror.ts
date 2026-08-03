import { NextResponse } from "next/server";

/**
 * Réponse d'erreur des routes de formulaire.
 *
 * Le corps porte DEUX choses :
 *  - `error` : la phrase française, telle qu'elle était avant l'i18n. Elle reste
 *    le repli affichable pour tout appelant qui ne connaît pas les codes (bot,
 *    curl, ancien client en cache) ;
 *  - `code` (+ `params`) : l'identifiant stable que le navigateur traduit dans
 *    la langue de la page. Le serveur ne connaît pas la langue de l'onglet —
 *    c'est le client qui la porte, donc c'est lui qui traduit.
 *
 * Ajouter un code ici impose d'ajouter la clé correspondante dans
 * `messages/*.json` sous `formErrors` : le test `src/lib/apierror.test.ts` le
 * vérifie et échoue sinon.
 */
export const API_ERROR_CODES = [
  "invalidRequest",
  "rateLimited",
  "tooFast",
  "consentRequired",
  "missingFields",
  "tooLong",
  "roleUnavailable",
  "ageMin",
  "gameRequired",
  "invalidEmail",
  "messageTooShort",
  "saveFailed",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorParams = Record<string, string | number>;

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  opts: { params?: ApiErrorParams; headers?: Record<string, string> } = {},
) {
  return NextResponse.json(
    { ok: false, error: message, code, ...(opts.params ? { params: opts.params } : {}) },
    { status, ...(opts.headers ? { headers: opts.headers } : {}) },
  );
}
