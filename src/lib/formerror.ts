// Traduction côté navigateur des erreurs renvoyées par les routes de formulaire.
//
// Le serveur ne connaît pas la langue de l'onglet : il renvoie un `code` stable
// (+ des `params`) et une phrase française de repli. C'est ici qu'on choisit
// l'un ou l'autre.

export type ApiErrorBody = {
  error?: unknown;
  code?: unknown;
  params?: unknown;
};

/** Fonction de traduction telle que la renvoie `useTranslations` (avec `.has`). */
type Translator = {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
};

/**
 * Message à afficher pour une réponse d'erreur.
 *
 * Ordre de préférence :
 *  1. le code traduit dans la langue de la page ;
 *  2. la phrase `error` renvoyée par le serveur (français) ;
 *  3. un message générique.
 *
 * `tField` traduit le nom d'un champ (cas `tooLong`), qui arrive sous forme de
 * clé technique (`motiv`, `rltracker`…) et non de libellé.
 */
export function translateApiError(
  body: ApiErrorBody | null | undefined,
  t: Translator,
  tField: Translator,
): string {
  const code = typeof body?.code === "string" ? body.code : null;
  const raw = body?.params;
  const params: Record<string, string | number> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).filter(
            ([, v]) => typeof v === "string" || typeof v === "number",
          ),
        ) as Record<string, string | number>)
      : {};

  if (code && t.has(code)) {
    // `tooLong` référence un nom de champ : il doit être traduit lui aussi,
    // sinon on afficherait « Le champ « motiv » … » au lieu de « Motivation ».
    if (typeof params.field === "string" && tField.has(params.field)) {
      return t(code, { ...params, field: tField(params.field) });
    }
    return t(code, params);
  }

  if (typeof body?.error === "string" && body.error) return body.error;
  return t("generic");
}
