"use client";

import { useSyncExternalStore } from "react";

// Le store ne change jamais pendant une session : abonnement no-op.
const subscribe = () => () => {};

/**
 * Année courante fiable. Les pages statiques figent `new Date()` au build.
 * `useSyncExternalStore` rend l'année passée par le serveur (build ou requête)
 * pendant l'hydratation, puis l'année réelle du navigateur — sans décalage
 * d'hydratation ni setState dans un effet.
 */
export default function CurrentYear({ initial }: { initial: number }) {
  return useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(), // client : année réelle
    () => initial, // serveur : année du rendu (fallback)
  );
}
