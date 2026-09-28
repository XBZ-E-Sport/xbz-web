import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Vrai si la requête porte `Authorization: Bearer <CRON_SECRET>` (en-tête que
 * Vercel Cron ajoute à ses appels).
 *
 * Fail-safe : sans secret configuré, l'endpoint reste FERMÉ — mieux vaut un
 * cron qui ne tourne pas qu'un endpoint de purge ou d'envoi ouvert à tous.
 *
 * Comparaison en temps constant, sur les empreintes SHA-256 des deux valeurs
 * (même longueur quelle que soit l'entrée) : un `===` s'arrête au premier
 * caractère différent, et ce temps de réponse renseigne sur le secret.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(received, expected);
}
