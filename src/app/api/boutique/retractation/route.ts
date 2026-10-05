import { NextResponse } from "next/server";

import { apiError } from "@/lib/apierror";
import { checkSpam } from "@/lib/antispam";
import { FIELD_MAX, findTooLong, textField, tooLongMessage } from "@/lib/limits";
import { checkFormRateLimit, getClientIp } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLike, matchOrder } from "@/lib/withdrawal";
import {
  finishWithdrawalAfterResponse,
  MAX_ACK_ATTEMPTS,
  MAX_ACK_PER_EMAIL_PER_DAY,
} from "@/lib/withdrawal-server";

// Rétractation en ligne : « Renoncer au contrat ici », puis « Confirmer la
// rétractation » (le navigateur n'appelle cette route qu'à la confirmation).
//
// Principe : une déclaration valide est TOUJOURS enregistrée, même si la
// commande ne peut pas être rapprochée — la loi ne laisse pas au vendeur le
// droit de la refuser faute d'identification parfaite. Le rapprochement
// (`match`) dit seulement au staff s'il doit vérifier à la main.
//
// L'accusé de réception part APRÈS la réponse (`after`) : une panne du
// fournisseur d'e-mails ne fait jamais échouer la déclaration, elle est notée
// (`ack_error`) et le cron réessaie. La réponse ne confirme rien sur les
// commandes de la personne : on ne dit pas si cet e-mail a acheté.

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = ["fr", "en"] as const;

export async function POST(request: Request) {
  // Appelée par nos pages seulement (même garde que la route de paiement).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return apiError(403, "invalidRequest", "Requête invalide.");
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }

  const { allowed, retryAfter } = await checkFormRateLimit(getClientIp(request), "retractation");
  if (!allowed) {
    return apiError(429, "rateLimited", "Trop de tentatives. Réessaie dans une minute.", {
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  // Anti-spam : piège rempli → on répond OK sans rien enregistrer ni envoyer ;
  // envoi trop rapide pour un humain → refusé.
  const { spam, tooFast } = checkSpam(body);
  if (spam) return NextResponse.json({ ok: true, receivedAt: new Date().toISOString() });
  if (tooFast) return apiError(429, "tooFast", "Envoi trop rapide, réessaie dans un instant.");

  const nom = textField(body.nom);
  const email = textField(body.email);
  const commande = textField(body.commande);
  const details = textField(body.details);
  if (nom === null || email === null || commande === null || details === null) {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }
  if (!nom || !email) return apiError(400, "missingFields", "Champs obligatoires manquants.");
  if (!EMAIL.test(email)) return apiError(422, "invalidEmail", "Adresse email invalide.");
  const tooLong = findTooLong({ nom, email, commande, details });
  if (tooLong) {
    return apiError(422, "tooLong", tooLongMessage(tooLong), {
      params: { field: tooLong, max: FIELD_MAX[tooLong] },
    });
  }
  const locale = LOCALES.find((l) => l === body.locale) ?? "fr";

  const admin = createAdminClient();

  // Commandes PAYÉES de cet e-mail (casse ignorée, aucun joker toléré).
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id")
    .in("status", ["paid", "fulfilled"])
    .ilike("customer_email", escapeLike(email))
    .order("created_at", { ascending: false })
    .limit(20);
  if (ordersError) {
    // Pas de rapprochement possible ne doit pas coûter sa déclaration au client :
    // on l'enregistre « non rapprochée », le staff la traitera à la main.
    console.error("[retractation] lecture des commandes:", ordersError.message);
  }
  const matched = matchOrder((orders ?? []) as { id: string }[], commande || null);

  // Plafond d'accusés par adresse et par jour (voir MAX_ACK_PER_EMAIL_PER_DAY). Si le
  // comptage échoue on ne bride rien : la limite par IP reste en place.
  const { count: recent } = await admin
    .from("order_withdrawals")
    .select("id", { count: "exact", head: true })
    .ilike("customer_email", escapeLike(email))
    .gte("received_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  const throttled = (recent ?? 0) >= MAX_ACK_PER_EMAIL_PER_DAY;

  const { data, error } = await admin
    .from("order_withdrawals")
    .insert({
      order_id: matched.orderId,
      order_number: matched.orderNumber,
      match: ordersError ? "none" : matched.match,
      customer_name: nom,
      customer_email: email,
      details: details || null,
      locale,
      // Plafond atteint : déclaration gardée, envoi automatique suspendu.
      ...(throttled
        ? { ack_attempts: MAX_ACK_ATTEMPTS, ack_error: `plafond de ${MAX_ACK_PER_EMAIL_PER_DAY} accusés par adresse et par jour atteint` }
        : {}),
    })
    .select("id, received_at")
    .single();

  if (error || !data) {
    console.error("[retractation] enregistrement:", error?.message ?? "aucune ligne");
    return apiError(500, "saveFailed", "Envoi impossible pour le moment. Réessaie dans quelques minutes.");
  }

  finishWithdrawalAfterResponse(admin, data.id);

  return NextResponse.json({ ok: true, receivedAt: data.received_at });
}
