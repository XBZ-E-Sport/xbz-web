import { NextResponse } from "next/server";

import { reportError } from "@/lib/report-error";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

// Reçoit les rapports d'erreurs CLIENT (depuis global-error + instrumentation-client)
// et les relaie au sink. Endpoint public → limité par IP (anti-abus/flood).
export async function POST(request: Request) {
  const { allowed } = await checkRateLimit(getClientIp(request), "report-error", {
    limit: 10,
    windowSeconds: 60,
  });
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });

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
