// Envoi best-effort d'une erreur CLIENT vers /api/report-error (qui la relaie
// au sink serveur). Ne doit JAMAIS casser l'app → tout est encapsulé en try/catch.

type ClientErrorInput = {
  message: string;
  stack?: string;
  path?: string;
  digest?: string;
};

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
