import { NextResponse } from "next/server";

import { reportError } from "@/lib/report-error";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

// Reçoit les rapports d'erreurs CLIENT (depuis global-error + instrumentation-client)
// et les relaie au sink. Endpoint public → limité par IP (anti-abus/flood).
export async function POST(request: Request) {
  // Nos pages postent en same-origin. Un navigateur envoyant « cross-site »,
  // c'est une autre page qui fait poster ses visiteurs chez nous (chacun avec
  // sa propre IP). Sans l'en-tête (curl, vieux navigateur), on laisse passer.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return NextResponse.json({ ok: false }, { status: 403 });

  // Une panne du compteur ne doit pas rendre le site aveugle : la remontée
  // d'erreurs part vers Discord, pas vers Supabase, et c'est justement
  // pendant un incident qu'on en a besoin (d'où `failOpen`).
  const { allowed } = await checkRateLimit(getClientIp(request), "report-error", {
    limit: 10,
    windowSeconds: 60,
    failOpen: true,
  });
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });
  // Le plafond GLOBAL (toutes IP) est appliqué par `reportError`, après la
  // déduplication : voir CLIENT_REPORTS_PER_MINUTE.

  let body: {
    message?: unknown;
    stack?: unknown;
    path?: unknown;
    digest?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await reportError({
    source: "client",
    message: String(body.message ?? "").slice(0, 500) || "Erreur client inconnue",
    stack: body.stack ? String(body.stack).slice(0, 4000) : undefined,
    path: body.path ? String(body.path).slice(0, 300) : undefined,
    extra: body.digest ? { digest: String(body.digest).slice(0, 100) } : undefined,
  });

  return NextResponse.json({ ok: true });
}
