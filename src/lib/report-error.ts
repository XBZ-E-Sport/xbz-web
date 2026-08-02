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

/** Construit le payload webhook Discord (embed) à partir d'un rapport. */
export function buildDiscordPayload(report: ErrorReport, iso: string) {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Source", value: report.source, inline: true },
  ];
  if (report.path) fields.push({ name: "Chemin", value: clamp(report.path, 200), inline: true });
  for (const [k, v] of Object.entries(report.extra ?? {})) {
    if (v == null || v === "") continue;
    fields.push({ name: clamp(k, 40), value: clamp(String(v), 200), inline: true });
  }

  return {
    username: "XBZ · Erreurs",
    embeds: [
      {
        title: clamp(`🚨 ${report.message}`, 240),
        description: report.stack ? "```\n" + clamp(report.stack, 1500) + "\n```" : undefined,
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

/** Point d'entrée unique : rapporte une erreur (dédupliquée) au sink. */
export async function reportError(report: ErrorReport): Promise<void> {
  const signature = `${report.source}:${report.path ?? ""}:${report.message}`;
  if (!shouldSend(signature, Date.now())) return;
  await deliver(report);
}
