// Sink de monitoring d'erreurs — PLUGGABLE.
// Aujourd'hui : webhook Discord. Pour brancher Sentry (ou autre) plus tard, il
// suffit de remplacer le corps de `deliver()` — le reste de l'app ne change pas.
//
// Cible : env `DISCORD_ERROR_WEBHOOK_URL` (webhook de salon Discord, ou un
// endpoint de ton bot). Absente → on log seulement (build / CI / dev restent
// muets côté Discord). Server-only : jamais importé par un composant client.

import "server-only";

export type ErrorSource = "server" | "client";

export type ErrorReport = {
  source: ErrorSource;
  message: string;
  stack?: string;
  path?: string;
  extra?: Record<string, unknown>;
};

// Anti-flood : on ne renvoie pas la même signature d'erreur plus d'une fois par
// fenêtre (en mémoire, best-effort — suffisant pour éviter d'inonder Discord).
const DEDUP_MS = 60_000;
const recent = new Map<string, number>();

function shouldSend(signature: string, now: number): boolean {
  if (recent.size > 300) recent.clear(); // garde-fou mémoire
  const last = recent.get(signature);
  if (last !== undefined && now - last < DEDUP_MS) return false;
  recent.set(signature, now);
  return true;
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Erreurs serveur BÉNIGNES et non actionnables : on ne les relaie pas au canal.
//
// « Failed to find Server Action » : l'ID haché d'une Server Action change à
// CHAQUE déploiement. Le message ne peut donc survenir que si la requête porte
// l'ID d'un AUTRE déploiement — jamais à cause d'un bug du code en ligne. Deux
// origines, toutes deux hors de notre contrôle :
//   1. skew de déploiement — un onglet resté ouvert AVANT une mise en prod
//      soumet un formulaire APRÈS : l'ancien ID n'existe plus (Next le documente
//      lui-même comme « from an older or newer deployment ») ; le client se
//      répare en rechargeant ;
//   2. robot / scanner qui POST des URL bidon (ex. /fr/index.php — aucun `.php`
//      n'existe chez nous) : pur bruit d'internet, aucun visiteur réel.
// Rien à corriger dans les deux cas → on écarte ce message du monitoring.
const IGNORABLE_SERVER_ERROR = /Failed to find Server Action/i;

/** Vrai pour une erreur SERVEUR connue comme bénigne (à ne pas relayer). */
export function isIgnorableServerError(report: ErrorReport): boolean {
  return report.source === "server" && IGNORABLE_SERVER_ERROR.test(report.message);
}

// --- Texte venu de l'extérieur → affichage inerte dans Discord --------------
// Un rapport CLIENT est écrit par n'importe qui (route publique). Sans ces
// précautions, `[Connexion staff](https://…)` devenait un lien cliquable dans
// le salon du staff, sous le nom « XBZ · Erreurs », et un « ``` » dans la stack
// sortait du bloc de code. On les applique aussi aux erreurs serveur, dont le
// message peut reprendre une donnée d'entrée.

/** Backtick → accent grave modificatif (ˋ) : plus aucun moyen de fermer un code. */
const noBacktick = (value: string) => value.replace(/`/g, "ˋ");

/** Code en ligne : rien n'y est interprété (ni lien, ni mise en forme). */
export function inlineCode(value: string): string {
  return `\`${noBacktick(value)}\``;
}

/** Échappe la mise en forme Markdown de Discord (liens masqués compris). */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_~|>[\]()]/g, (c) => `\\${c}`);
}

/** Construit le payload webhook Discord (embed) à partir d'un rapport. */
export function buildDiscordPayload(report: ErrorReport, iso: string) {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: "Source",
      // Rien ne garantit qu'un rapport client vient vraiment d'un visiteur.
      value: report.source === "client" ? "client (non vérifié)" : report.source,
      inline: true,
    },
  ];
  if (report.path) fields.push({ name: "Chemin", value: inlineCode(clamp(report.path, 200)), inline: true });
  for (const [k, v] of Object.entries(report.extra ?? {})) {
    if (v == null || v === "") continue;
    fields.push({ name: escapeMarkdown(clamp(k, 40)), value: inlineCode(clamp(String(v), 200)), inline: true });
  }

  return {
    username: "XBZ · Erreurs",
    // Aucune mention ne notifie qui que ce soit (@everyone, rôles, membres).
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: clamp(`🚨 ${escapeMarkdown(report.message)}`, 240),
        description: report.stack ? "```\n" + noBacktick(clamp(report.stack, 1500)) + "\n```" : undefined,
        color: 0xff4444,
        fields,
        timestamp: iso,
      },
    ],
  };
}

/** Envoie effectivement le rapport au sink (remplacer ici pour Sentry, etc.). */
async function deliver(report: ErrorReport): Promise<void> {
  const url = process.env.DISCORD_ERROR_WEBHOOK_URL;
  if (!url) {
    console.error(`[monitor:${report.source}]`, report.message, report.path ?? "");
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDiscordPayload(report, new Date().toISOString())),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[monitor] envoi Discord échoué:", e);
  }
}

// Plafond des rapports CLIENT réellement relayés, toutes IP confondues, par
// instance : le plafond par IP de la route ne suffit pas (en changeant d'IP,
// on saturait la limite du webhook Discord — 30 envois/min — et les vraies
// erreurs se perdaient). Compté APRÈS la déduplication : une même erreur
// répétée n'use pas le quota des autres. En mémoire plutôt qu'en base : pas
// d'aller-retour, et pas de risque qu'une rafale simultanée bloque tout.
// Les erreurs SERVEUR n'y sont pas soumises : un flood client ne les masque pas.
export const CLIENT_REPORTS_PER_MINUTE = 20;
const clientSent: number[] = [];

function clientBudgetAvailable(now: number): boolean {
  while (clientSent.length && now - clientSent[0] >= 60_000) clientSent.shift();
  if (clientSent.length >= CLIENT_REPORTS_PER_MINUTE) return false;
  clientSent.push(now);
  return true;
}

/** Point d'entrée unique : rapporte une erreur (dédupliquée) au sink. */
export async function reportError(report: ErrorReport): Promise<void> {
  // Bruit connu (skew de déploiement / robots) : jamais un bug du code en ligne.
  if (isIgnorableServerError(report)) return;
  const now = Date.now();
  const signature = `${report.source}:${report.path ?? ""}:${report.message}`;
  if (!shouldSend(signature, now)) return;
  if (report.source === "client" && !clientBudgetAvailable(now)) return;
  await deliver(report);
}
