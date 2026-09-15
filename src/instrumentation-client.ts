// Instrumentation client (Next 15.3+) : s'exécute avant l'hydratation.
// On capte les erreurs navigateur GLOBALES que les error boundaries React ne
// voient pas (erreurs hors rendu, promesses rejetées) et on les remonte au sink.
//
// On IGNORE ce qui ne vient pas de notre code : une extension de navigateur qui
// plante dans la page (voir isThirdPartyError). Sinon le Discord staff reçoit
// des « bugs » qui sont en réalité ceux d'une extension du visiteur.

import { reportClientError, isThirdPartyError } from "@/lib/client-report";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const message = event.message || event.error?.message || "window.error";
    const stack = event.error?.stack;
    if (isThirdPartyError({ message, stack, filename: event.filename })) return;
    reportClientError({ message, stack });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? "unhandledrejection");
    const stack = reason instanceof Error ? reason.stack : undefined;
    if (isThirdPartyError({ message, stack })) return;
    reportClientError({ message, stack });
  });
}
