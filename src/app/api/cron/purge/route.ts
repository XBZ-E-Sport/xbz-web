import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Purge RGPD (minimisation / limitation de conservation).
// Supprime les candidatures et messages support plus vieux que RETENTION_MONTHS.
//
// Déclenchement : le Cron de Vercel (voir vercel.json) appelle cette route selon
// la planification. Vercel joint l'en-tête `Authorization: Bearer $CRON_SECRET`
// dès que la variable d'environnement `CRON_SECRET` est définie. On refuse tout
// appel dont le jeton ne correspond pas : la route est publique mais protégée.
//
// Écritures via service_role (createAdminClient) → contourne la RLS.

export const dynamic = "force-dynamic";

const RETENTION_MONTHS = 24;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Pas de secret configuré → on ne purge JAMAIS (fail-safe : mieux vaut ne rien
  // supprimer qu'exposer un endpoint de suppression non authentifié).
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function purge() {
  const admin = createAdminClient();

  // Date de coupure : maintenant − RETENTION_MONTHS.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const iso = cutoff.toISOString();

  const candidatures = await admin
    .from("candidatures")
    .delete()
    .lt("created_at", iso)
    .select("id");
  if (candidatures.error) throw new Error(`candidatures: ${candidatures.error.message}`);

  const support = await admin
    .from("support_messages")
    .delete()
    .lt("created_at", iso)
    .select("id");
  if (support.error) throw new Error(`support_messages: ${support.error.message}`);

  return {
    cutoff: iso,
    retentionMonths: RETENTION_MONTHS,
    deleted: {
      candidatures: candidatures.data?.length ?? 0,
      support_messages: support.data?.length ?? 0,
    },
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }
  try {
    const result = await purge();
    console.log("[cron/purge]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("[cron/purge]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
