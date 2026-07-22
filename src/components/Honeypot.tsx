/**
 * Piège anti-bot invisible. Le champ `website` est hors écran et non focusable :
 * un humain ne le remplit jamais. Le serveur (checkSpam) ignore silencieusement
 * toute soumission où il est rempli.
 *
 * `id` doit être unique par formulaire (association <label>/<input>) — ex.
 * "rec-website", "support-website".
 *
 * Composant purement présentationnel (pas de "use client") : rendu tel quel
 * dans les formulaires clients.
 */
export default function Honeypot({ id }: { id: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
    >
      <label htmlFor={id}>Ne pas remplir</label>
      <input id={id} name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
