import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { retryPendingConfirmations } from "@/lib/order-confirmation";
import { sweepStaleReservations } from "@/lib/shop";
import { isStripeConfigured } from "@/lib/stripe";
import { retryPendingAcks } from "@/lib/withdrawal-server";

// Purge RGPD (minimisation / limitation de conservation).
// Supprime les candidatures et messages support plus vieux que RETENTION_MONTHS.
// Les COMMANDES n'y passent pas : ce sont des pièces comptables, gardées 10 ans.
// RAPPEL : les premières ont 10 ans en octobre 2036 — d'ici là, ajouter ici leur
// suppression (ou anonymisation de nom, e-mail et adresse), avec un an de marge
// (le délai court souvent à partir de la clôture de l'exercice, pas de la vente).
//
// Au passage, filets de la boutique :
//  - une réservation de stock dont le webhook Stripe se serait perdu est rendue
//    (après vérification chez Stripe) ;
//  - un accusé de réception de rétractation qui n'a pas pu partir (fournisseur
//    d'e-mails en panne) est renvoyé ; de même une confirmation de commande dont le
//    premier envoi a échoué.
//
// Déclenchement : le Cron de Vercel (voir vercel.json) appelle cette route selon
// la planification. Vercel joint l'en-tête `Authorization: Bearer $CRON_SECRET`
// dès que la variable d'environnement `CRON_SECRET` est définie. On refuse tout
// appel dont le jeton ne correspond pas : la route est publique mais protégée.
//
// Écritures via service_role (createAdminClient) → contourne la RLS.

export const dynamic = "force-dynamic";
// Le filet des accusés appelle un fournisseur d'e-mails (jusqu'à 15 s chacun, en parallèle).
export const maxDuration = 60;

const RETENTION_MONTHS = 24;
// Déclarations de rétractation : prescription des actions entre consommateur et vendeur.
const WITHDRAWAL_RETENTION_YEARS = 5;
// Déclarations au piège anti-bot rempli : du bruit, sauf rare faux positif déjà traité depuis.
const SUSPECT_RETENTION_DAYS = 30;
// Les IP anti-flood n'ont d'utilité qu'une minute : une heure suffit largement.
const RATE_LIMIT_RETENTION_HOURS = 1;

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

  // Rétractations : 5 ans (puis suppression) ; le bruit au piège rempli, 30 jours. Une
  // erreur ici (migration pas encore passée…) ne doit pas bloquer le reste de la purge.
  const withdrawalCutoff = new Date();
  withdrawalCutoff.setFullYear(withdrawalCutoff.getFullYear() - WITHDRAWAL_RETENTION_YEARS);
  const suspectCutoff = new Date(Date.now() - SUSPECT_RETENTION_DAYS * 24 * 3600_000);
  const oldWithdrawals = await admin
    .from("order_withdrawals")
    .delete()
    .lt("received_at", withdrawalCutoff.toISOString())
    .select("id");
  const suspectWithdrawals = await admin
    .from("order_withdrawals")
    .delete()
    .eq("suspect", true)
    .lt("received_at", suspectCutoff.toISOString())
    .select("id");
  for (const r of [oldWithdrawals, suspectWithdrawals]) {
    if (r.error && r.error.code !== "42P01" && r.error.code !== "PGRST205") {
      console.error("[cron/purge] order_withdrawals:", r.error.message);
    }
  }

  // Filet de sécurité anti-flood : `checkRateLimit` purge déjà les hits passés
  // à chaque requête, mais seulement s'il y a du trafic. Sans visite pendant
  // plusieurs jours, des IP resteraient stockées — d'où ce balayage quotidien.
  const ipCutoff = new Date(Date.now() - RATE_LIMIT_RETENTION_HOURS * 3600_000).toISOString();
  const hits = await admin
    .from("rate_limit_hits")
    .delete()
    .lt("created_at", ipCutoff)
    .select("id");
  if (hits.error) throw new Error(`rate_limit_hits: ${hits.error.message}`);

  const reservationsReleased = isStripeConfigured() ? await sweepStaleReservations(admin, 50) : 0;
  const withdrawalAcksSent = await retryPendingAcks(admin, 10);
  const orderConfirmationsSent = await retryPendingConfirmations(admin, 10);

  return {
    cutoff: iso,
    retentionMonths: RETENTION_MONTHS,
    deleted: {
      candidatures: candidatures.data?.length ?? 0,
      support_messages: support.data?.length ?? 0,
      rate_limit_hits: hits.data?.length ?? 0,
      order_withdrawals: (oldWithdrawals.data?.length ?? 0) + (suspectWithdrawals.data?.length ?? 0),
    },
    reservationsReleased,
    withdrawalAcksSent,
    orderConfirmationsSent,
  };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
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
