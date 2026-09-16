// Notifications Discord des matchs — envoi vers un webhook de salon.
//
// Cible : env `DISCORD_MATCHS_WEBHOOK_URL` (webhook d'un salon Discord). Absente
// → on log seulement. Server-only : jamais importé par un composant client.
//
// Deux messages : le RAPPEL (« match bientôt ») posté peu avant chaque match, et
// le DIGEST quotidien (« les matchs du jour »). Les fonctions de décision et de
// mise en forme sont pures → testées ; seul `sendMatchDiscord` fait le réseau.

import "server-only";

import { formatMatchDateTime } from "@/lib/matchs";

export type MatchNotif = {
  rosterName: string | null;
  opponent: string;
  competition: string;
  format: string;
  startsAt: string; // heure murale FR, sans fuseau (ex. "2026-09-20T18:00:00")
  streamUrl: string | null;
};

// --- Temps : tout est comparé en « heure murale FR interprétée en UTC » -------
// `starts_at` est stocké sans fuseau (heure française). Pour comparer « le match
// commence dans X minutes », on convertit AUSSI l'instant présent en heure de
// Paris, puis on lit les deux comme de l'UTC : la différence est alors la vraie
// distance en minutes, sans dérive d'heure d'été.

/** L'instant présent, en heure de Paris, exprimé en millisecondes « UTC ». */
export function nowParisMs(base: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(base);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour"); // minuit selon les moteurs
  return Date.parse(`${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}Z`);
}

/** L'heure de début d'un match (heure murale) en millisecondes « UTC ». */
export function matchStartMs(startsAt: string): number {
  const norm = (startsAt.includes("T") ? startsAt : startsAt.replace(" ", "T")).slice(0, 19);
  return Date.parse(`${norm}Z`);
}

/** Vrai si le match commence dans la fenêtre de rappel (et pas déjà loin passé). */
export function isWithinReminderWindow(
  startsAt: string,
  nowMs: number,
  windowMinutes: number,
  graceMinutes = 15,
): boolean {
  const diff = matchStartMs(startsAt) - nowMs;
  return diff <= windowMinutes * 60_000 && diff >= -graceMinutes * 60_000;
}

/** Date du jour en heure de Paris, "YYYY-MM-DD". */
export function parisDayStr(base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

/** Vrai si le match a lieu le jour `dayStr` ("YYYY-MM-DD"). */
export function isSameDay(startsAt: string, dayStr: string): boolean {
  return startsAt.slice(0, 10) === dayStr;
}

// --- Mise en forme des messages Discord --------------------------------------

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function matchLine(m: MatchNotif): string {
  const xbz = m.rosterName ?? "XBZ";
  const compet = m.competition ? ` — ${m.competition}` : "";
  const stream = m.streamUrl ? `\n📺 ${m.streamUrl}` : "";
  return `**${xbz}** vs **${m.opponent}**${compet} (${m.format})\n🕓 ${formatMatchDateTime(m.startsAt, "fr")}${stream}`;
}

/** Payload webhook Discord pour le rappel d'un match imminent. */
export function buildReminderPayload(m: MatchNotif) {
  return {
    username: "XBZ · Matchs",
    embeds: [
      {
        title: clamp(`⏰ Match bientôt : ${m.rosterName ?? "XBZ"} vs ${m.opponent}`, 240),
        description: clamp(matchLine(m), 4000),
        color: 0x0066ff,
      },
    ],
  };
}

/** Payload webhook Discord pour le digest des matchs du jour. */
export function buildDigestPayload(matches: MatchNotif[]) {
  return {
    username: "XBZ · Matchs",
    embeds: [
      {
        title: `📅 Les matchs du jour (${matches.length})`,
        description: clamp(matches.map((m) => `• ${matchLine(m)}`).join("\n\n"), 4000),
        color: 0x00c8ff,
      },
    ],
  };
}

/** Poste un payload sur le webhook Discord. Renvoie false si non configuré/échec. */
export async function sendMatchDiscord(payload: unknown): Promise<boolean> {
  const url = process.env.DISCORD_MATCHS_WEBHOOK_URL;
  if (!url) {
    console.error("[cron/matchs] DISCORD_MATCHS_WEBHOOK_URL manquante — envoi ignoré.");
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[cron/matchs] webhook Discord", res.status, await res.text().catch(() => ""));
    }
    return res.ok;
  } catch (e) {
    console.error("[cron/matchs] envoi webhook échoué:", e);
    return false;
  }
}
