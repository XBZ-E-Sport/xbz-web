// Instrumentation client (Next 15.3+) : s'exécute avant l'hydratation.
// On capte les erreurs navigateur GLOBALES que les error boundaries React ne
// voient pas (erreurs hors rendu, promesses rejetées) et on les remonte au sink.

import { reportClientError } from "@/lib/client-report";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    reportClientError({
      message: event.message || event.error?.message || "window.error",
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportClientError({
      message: reason instanceof Error ? reason.message : String(reason ?? "unhandledrejection"),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
