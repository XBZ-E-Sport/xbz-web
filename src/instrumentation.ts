import { type Instrumentation } from "next";

// Hook natif Next 16 : capte TOUTES les erreurs serveur (RSC, route handlers,
// server actions, proxy) et les relaie au sink de monitoring.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Import dynamique : garde le module de reporting hors du bundle tant qu'aucune
  // erreur n'est levée (et évite tout souci de runtime edge au chargement).
  const { reportError } = await import("@/lib/report-error");

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;

  await reportError({
    source: "server",
    message,
    stack,
    path: request.path,
    extra: {
      method: request.method,
      routeType: context.routeType,
      routePath: context.routePath,
      digest,
    },
  });
};
