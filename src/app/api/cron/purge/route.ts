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

/**
 * Une étape de la purge, isolée : son échec est journalisé tout de suite et noté, sans
 * empêcher les étapes suivantes. Le cron répond 500 à la fin s'il y en a eu un.
 */
async function step<T>(name: string, run: () => Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const msg = `${name}: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[cron/purge]", msg);
    errors.push(msg);
    return fallback;
  }
}

/** Suppression qui lève sur erreur (attrapée par `step`) et renvoie le nombre de lignes. */
async function deleted(res: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<number> {
  const { data, error } = await res;
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function purge() {
  const admin = createAdminClient();
  const errors: string[] = [];

  // Les PURGES d'abord (des DELETE rapides) : elles passent toujours, même si un filet
  // plus bas est lent (appels à Stripe ou au fournisseur d'e-mails) et que la fonction
  // atteint `maxDuration`. Chaque étape est isolée : une table en panne n'empêche ni les
  // autres purges, ni les filets de la boutique.

  // Date de coupure : maintenant − RETENTION_MONTHS.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const iso = cutoff.toISOString();

  const candidatures = await step(
    "candidatures",
    () => deleted(admin.from("candidatures").delete().lt("created_at", iso).select("id")),
    0,
    errors,
  );
  const support = await step(
    "support_messages",
    () => deleted(admin.from("support_messages").delete().lt("created_at", iso).select("id")),
    0,
    errors,
  );

  // Rétractations : 5 ans (puis suppression) ; le bruit au piège rempli, 30 jours. Une
  // table absente (migration pas encore passée) n'est pas une erreur.
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
  const hits = await step(
    "rate_limit_hits",
    () => deleted(admin.from("rate_limit_hits").delete().lt("created_at", ipCutoff).select("id")),
    0,
    errors,
  );

  // Filets de la boutique ENSUITE, chacun isolé : une purge en échec plus haut ne les
  // fait jamais sauter (remise en stock, relance des accusés de rétractation et des
  // confirmations de commande). Ils notent eux-mêmes leurs échecs d'envoi ligne par ligne ;
  // seule une exception imprévue est remontée ici.
  const reservationsReleased = isStripeConfigured()
    ? await step("réservations", () => sweepStaleReservations(admin, 50), 0, errors)
    : 0;
  const withdrawalAcksSent = await step("accusés de rétractation", () => retryPendingAcks(admin, 10), 0, errors);
  const orderConfirmationsSent = await step(
    "confirmations de commande",
    () => retryPendingConfirmations(admin, 10),
    0,
    errors,
  );

  return {
    errors,
    result: {
      cutoff: iso,
      retentionMonths: RETENTION_MONTHS,
      deleted: {
        candidatures,
        support_messages: support,
        rate_limit_hits: hits,
        order_withdrawals: (oldWithdrawals.data?.length ?? 0) + (suspectWithdrawals.data?.length ?? 0),
      },
      reservationsReleased,
      withdrawalAcksSent,
      orderConfirmationsSent,
    },
  };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }
  try {
    const { result, errors } = await purge();
    // Le bilan est toujours journalisé, même en cas d'échec partiel : ce qui a été fait
    // (e-mails partis, stock rendu) doit se voir.
    console.log("[cron/purge]", JSON.stringify(result));
    if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ; "), ...result }, { status: 500 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("[cron/purge]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
