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
  const elapsed = Number(body.elapsed);
  return {
    spam: honeypot.length > 0,
    // `elapsed > 0` évite un faux positif quand la valeur est absente/vide (0 ou NaN).
    tooFast: Number.isFinite(elapsed) && elapsed > 0 && elapsed < MIN_FILL_MS,
  };
}
