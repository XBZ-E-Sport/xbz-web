// Anti-spam serveur partagé pour les formulaires publics.
//  - honeypot : un champ piège `website` qu'un humain ne remplit jamais ;
//  - délai minimum : un envoi en moins de MIN_FILL_MS trahit un bot.
// Léger et sans stockage : suffisant pour dissuader le spam automatisé courant.

const MIN_FILL_MS = 2000;

export type SpamCheck = {
  /** Le piège a été rempli → très probablement un bot. */
  spam: boolean;
  /** Formulaire soumis trop vite pour un humain. */
  tooFast: boolean;
};

export function checkSpam(body: { website?: unknown; elapsed?: unknown }): SpamCheck {
  const honeypot = String(body.website ?? "").trim();
  // Chaîne ou nombre seulement : Number(["5000"]) vaut 5000.
  const elapsed =
    typeof body.elapsed === "string" || typeof body.elapsed === "number" ? Number(body.elapsed) : NaN;
  return {
    spam: honeypot.length > 0,
    // `elapsed` est OBLIGATOIRE : le formulaire l'envoie toujours une fois
    // interactif (useElapsed). Absent, vide ou invalide, c'est qu'on n'est pas
    // passé par le formulaire — avant, il suffisait de l'omettre pour sauter
    // le délai minimum.
    tooFast: !(Number.isFinite(elapsed) && elapsed >= MIN_FILL_MS),
  };
}
