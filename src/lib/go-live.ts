import "server-only";

import { legalMissing } from "@/lib/legal";
import { isMailConfigured } from "@/lib/mailer";

/**
 * Ce qui empêche d'encaisser pour de vrai (clé Stripe LIVE). Vide = prêt.
 *
 *  - les prérequis légaux de `src/lib/legal.ts` (médiateur, téléphone, rétractation
 *    en ligne) ;
 *  - l'envoi d'e-mails : sans lui, la fonction « Renoncer au contrat ici » enregistre
 *    la déclaration mais n'envoie pas l'accusé de réception que la loi exige.
 *
 * Une clé de test n'est jamais concernée (voir `isShopOpen` et la route de paiement).
 */
export function liveBlockers(): string[] {
  const missing = legalMissing();
  if (!isMailConfigured()) {
    missing.push("e-mail des accusés de réception non configuré (BREVO_API_KEY, MAIL_FROM_EMAIL)");
  }
  return missing;
}
