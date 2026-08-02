"use client";

import { useEffect, useRef } from "react";

/**
 * Anti-spam : mesure le temps (ms) écoulé depuis que le formulaire est devenu
 * interactif (montage). Le serveur rejette un envoi trop rapide (bot).
 *
 * Retourne un getter à appeler au moment de l'envoi :
 *   const elapsed = useElapsed();
 *   data.elapsed = elapsed();
 */
export function useElapsed(): () => string {
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  return () => (mountedAt.current ? String(Date.now() - mountedAt.current) : "");
}
