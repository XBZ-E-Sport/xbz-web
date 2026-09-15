// Envoi best-effort d'une erreur CLIENT vers /api/report-error (qui la relaie
// au sink serveur). Ne doit JAMAIS casser l'app → tout est encapsulé en try/catch.

type ClientErrorInput = {
  message: string;
  stack?: string;
  path?: string;
  digest?: string;
};

// Schémas d'URL propres aux scripts NON servis par le site : extensions de
// navigateur (Chrome/Firefox/Safari/Edge) et URL cross-origin masquée de Safari.
const THIRD_PARTY_ORIGIN = /(?:chrome|moz|safari|safari-web)-?extension:\/\/|webkit-masked-url:/i;

/**
 * Vrai quand l'erreur ne vient PAS de notre code.
 *
 * Deux cas, tous deux 100 % hors de notre contrôle et sans valeur pour le staff :
 *  1. un script injecté par une EXTENSION de navigateur plante dans la page
 *     (sa pile pointe vers `chrome-extension://…` / `moz-extension://…`) ;
 *  2. une erreur cross-origin OPAQUE (« Script error. » sans pile ni fichier),
 *     que le navigateur masque pour raisons de sécurité — rien d'exploitable.
 *
 * Cas vécu : l'extension `eppiocemhmnlbhjplcgkofciiegomcon` plantait sur
 * `/fr/equipes` avec « Cannot read properties of undefined (reading 'M_ID') »,
 * remonté au Discord staff comme un bug du site — alors que `M_ID` n'existe
 * nulle part chez nous. Ces erreurs ne doivent plus polluer le canal.
 */
export function isThirdPartyError(input: {
  message?: string;
  stack?: string;
  filename?: string;
}): boolean {
  const { message, stack, filename } = input;
  if (filename && THIRD_PARTY_ORIGIN.test(filename)) return true;
  if (stack && THIRD_PARTY_ORIGIN.test(stack)) return true;
  // Erreur cross-origin masquée : message générique, aucun détail.
  if ((message === "Script error." || message === "Script error") && !stack) return true;
  return false;
}

export function reportClientError(input: ClientErrorInput): void {
  try {
    const body = JSON.stringify({
      message: input.message?.slice(0, 500) || "Erreur client inconnue",
      stack: input.stack?.slice(0, 4000),
      path: input.path ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
      digest: input.digest,
    });

    // `sendBeacon` survit à un unload de page ; sinon fetch keepalive.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/report-error", new Blob([body], { type: "application/json" }));
    } else if (typeof fetch === "function") {
      void fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Le reporting ne doit jamais provoquer d'erreur secondaire.
  }
}
