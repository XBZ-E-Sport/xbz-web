// Version des bannières Open Graph (module léger : importable par les pages
// sans tirer le moteur de rendu des images). Voir src/lib/og-routes.ts.

import { createHash } from "node:crypto";

import type { OgFrameOptions } from "@/lib/og";
import { siteConfig } from "@/lib/site";

/**
 * Version du déploiement (commit Vercel, 7 caractères), « local » hors Vercel.
 * Inscrite dans le code au build par `next.config.ts` (`env`) : identique pour
 * les pages prérendues et pour les routes d'image, quoi qu'expose l'exécution.
 */
export const OG_DEPLOY_VERSION = process.env.OG_BUILD_VERSION ?? "local";

/**
 * Identifiant d'une bannière tirée de la base : change avec le déploiement ET
 * avec chacun des textes affichés.
 */
export function ogContentVersion(...parts: (string | null | undefined)[]): string {
  return createHash("sha256")
    .update([OG_DEPLOY_VERSION, ...parts.map((p) => p ?? "")].join("\u0000"))
    .digest("hex")
    .slice(0, 12);
}

/** « Titre — XBZ Esport » : texte alternatif d'une bannière. */
export function ogAlt(title: string): string {
  return `${title} — ${siteConfig.name}`;
}

/** Bannière tirée de la base : ce qui est dessiné, et son texte alternatif. */
export type Banner = { frame: OgFrameOptions; alt: string };

/** Identifiant versionné d'une bannière : déploiement + chaque texte affiché. */
export function bannerVersion({ frame }: Banner): string {
  return ogContentVersion(frame.eyebrow, frame.title, frame.subtitle, frame.tone);
}
