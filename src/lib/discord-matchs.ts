// Notifications Discord des matchs — envoi vers un webhook de salon.
//
// Cible : env `DISCORD_MATCHS_WEBHOOK_URL` (webhook d'un salon Discord). Absente
// → on log seulement. Server-only : jamais importé par un composant client.
//
// Deux messages : le RAPPEL (« match bientôt ») posté peu avant chaque match, et
// le DIGEST quotidien (« les matchs du jour »). Les fonctions de décision et de
// mise en forme sont pures → testées ; seul `sendMatchDiscord` fait le réseau.

import "server-only";

// Logo du club (asset public) — icône d'auteur / vignette des embeds Discord.
const LOGO = "https://www.xbz-esport.org/logo-xbz.png";

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

/**
 * Instant RÉEL d'un match (secondes UNIX), pour les timestamps dynamiques de
 * Discord (`<t:…>`). `starts_at` est une heure murale FR : on la convertit en
 * UTC en récupérant le décalage de Paris À CETTE DATE (donc juste, été comme
 * hiver). Discord affiche ensuite « dans 1h » / la date, traduits par membre.
 */
export function parisWallClockToUnix(startsAt: string): number {
  const naiveUtc = matchStartMs(startsAt); // l'heure murale lue comme de l'UTC
  const offsetMs = nowParisMs(new Date(naiveUtc)) - naiveUtc; // décalage de Paris à cette date
  return Math.floor((naiveUtc - offsetMs) / 1000);
}

const matchTitle = (m: MatchNotif) => clamp(`${m.rosterName ?? "XBZ Esport"}  🆚  ${m.opponent}`, 240);
const streamLink = (m: MatchNotif) =>
  m.streamUrl ? `\n\n📺 **[Regarder le stream](${clamp(m.streamUrl, 400)})**` : "";

/** Colonnes compétition / format d'un match (champs d'embed). */
function matchFields(m: MatchNotif) {
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (m.competition) fields.push({ name: "🏆 Compétition", value: clamp(m.competition, 120), inline: true });
  fields.push({ name: "🎮 Format", value: m.format, inline: true });
  return fields;
}

/** Payload webhook Discord pour le rappel d'un match imminent (une carte). */
export function buildReminderPayload(m: MatchNotif) {
  const unix = parisWallClockToUnix(m.startsAt);
  return {
    username: "XBZ · Matchs",
    avatar_url: LOGO,
    embeds: [
      {
        author: { name: "⏰ Match bientôt", icon_url: LOGO },
        title: matchTitle(m),
        description: `**Coup d'envoi <t:${unix}:R>**\n🗓️ <t:${unix}:F>${streamLink(m)}`,
        color: 0xdc2515,
        fields: matchFields(m),
        footer: { text: "XBZ Esport · Calendrier" },
      },
    ],
  };
}

/**
 * Payload webhook Discord pour le digest du jour : un embed d'en-tête + une
 * carte par match (Discord accepte jusqu'à 10 embeds ; on plafonne à 9 cartes).
 */
export function buildDigestPayload(matches: MatchNotif[]) {
  const MAX_CARDS = 9;
  const shown = matches.slice(0, MAX_CARDS);
  const extra = matches.length - shown.length;

  const header = {
    title: "📅 Les matchs du jour",
    description:
      (matches.length > 1 ? `**${matches.length} matchs** au programme aujourd'hui 👇` : `**1 match** au programme aujourd'hui 👇`) +
      (extra > 0 ? `\n_(+ ${extra} autres — voir le calendrier)_` : ""),
    color: 0xfccd05,
    thumbnail: { url: LOGO },
  };

  const cards = shown.map((m) => {
    const unix = parisWallClockToUnix(m.startsAt);
    const compet = m.competition ? `🏆 ${clamp(m.competition, 100)}  ·  ` : "";
    const stream = m.streamUrl ? `  ·  📺 [stream](${clamp(m.streamUrl, 400)})` : "";
    return {
      title: matchTitle(m),
      description: `${compet}🎮 ${m.format}\n🕓 <t:${unix}:t>  ·  **<t:${unix}:R>**${stream}`,
      color: 0xdc2515,
    };
  });

  return { username: "XBZ · Matchs", avatar_url: LOGO, embeds: [header, ...cards] };
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
