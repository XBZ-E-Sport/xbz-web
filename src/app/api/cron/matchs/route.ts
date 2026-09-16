import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildReminderPayload,
  buildDigestPayload,
  isWithinReminderWindow,
  isSameDay,
  nowParisMs,
  parisDayStr,
  sendMatchDiscord,
  type MatchNotif,
} from "@/lib/discord-matchs";

// Notifications Discord des matchs, déclenchées par le Cron de Vercel.
//   /api/cron/matchs?job=digest → digest quotidien « les matchs du jour »
//   /api/cron/matchs?job=remind → rappel « match bientôt » (peu avant chaque match)
//
// Même garde que /api/cron/purge : Vercel joint `Authorization: Bearer $CRON_SECRET`.
// Lectures/écritures via service_role (createAdminClient) → hors RLS.

export const dynamic = "force-dynamic";

// Fenêtre du rappel : un match qui commence dans les N prochaines minutes est
// notifié. Avec un cron horaire, 90 min garantit un rappel 30–90 min avant.
const REMINDER_MINUTES = Number(process.env.MATCH_REMINDER_MINUTES) || 90;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-safe : pas de secret → endpoint fermé
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type MatchRow = {
  id: string;
  opponent: string;
  competition: string | null;
  format: string;
  starts_at: string;
  stream_url: string | null;
  rosters: { name: string } | null;
};

const SELECT = "id, opponent, competition, format, starts_at, stream_url, rosters(name)";

function toNotif(row: MatchRow): MatchNotif {
  return {
    rosterName: row.rosters?.name ?? null,
    opponent: row.opponent,
    competition: row.competition ?? "",
    format: row.format,
    startsAt: row.starts_at,
    streamUrl: row.stream_url ?? null,
  };
}

/** Rappels : matchs programmés entrant dans la fenêtre, pas encore rappelés. */
async function runReminders() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("matchs")
    .select(`${SELECT}, reminded_at`)
    .eq("active", true)
    .eq("status", "scheduled")
    .is("reminded_at", null);
  if (error) throw new Error(error.message);

  const nowMs = nowParisMs();
  const due = ((data ?? []) as unknown as MatchRow[]).filter((r) =>
    isWithinReminderWindow(r.starts_at, nowMs, REMINDER_MINUTES),
  );

  let sent = 0;
  for (const row of due) {
    const ok = await sendMatchDiscord(buildReminderPayload(toNotif(row)));
    if (ok) {
      await admin.from("matchs").update({ reminded_at: new Date().toISOString() }).eq("id", row.id);
      sent += 1;
    }
  }
  return { job: "remind", windowMinutes: REMINDER_MINUTES, candidates: due.length, sent };
}

/** Digest : les matchs programmés du jour (heure de Paris). Rien si aucun. */
async function runDigest() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("matchs")
    .select(SELECT)
    .eq("active", true)
    .eq("status", "scheduled");
  if (error) throw new Error(error.message);

  const day = parisDayStr();
  const today = ((data ?? []) as unknown as MatchRow[])
    .filter((r) => isSameDay(r.starts_at, day))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (today.length === 0) return { job: "digest", day, matches: 0, sent: false };

  const sent = await sendMatchDiscord(buildDigestPayload(today.map(toNotif)));
  return { job: "digest", day, matches: today.length, sent };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }
  const job = new URL(request.url).searchParams.get("job");
  try {
    const result = job === "remind" ? await runReminders() : job === "digest" ? await runDigest() : null;
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Paramètre `job` attendu : digest ou remind." },
        { status: 400 },
      );
    }
    console.log("[cron/matchs]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("[cron/matchs]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
