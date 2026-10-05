import { NextResponse } from "next/server";

import { apiError } from "@/lib/apierror";
import { checkSpam } from "@/lib/antispam";
import { FIELD_MAX, findTooLong, textField, tooLongMessage } from "@/lib/limits";
import { checkFormRateLimit, checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLikePattern, mailboxKey, matchOrder, sameEmail } from "@/lib/withdrawal";
import { finishWithdrawalAfterResponse } from "@/lib/withdrawal-server";

// Rétractation en ligne : « Renoncer au contrat ici », puis « Confirmer la
// rétractation » (le navigateur n'appelle cette route qu'à la confirmation).
//
// Principe : une déclaration valide est TOUJOURS enregistrée — jamais jetée, jamais
// refusée faute d'identification parfaite : la loi ne laisse pas au vendeur ce droit.
// Le rapprochement (`match`) dit seulement au staff s'il doit vérifier à la main, et
// un champ piège rempli (`suspect`) suspend l'accusé automatique sans perdre la
// déclaration (un gestionnaire de mots de passe peut remplir le champ caché d'un vrai
// client).
//
// L'accusé de réception part APRÈS la réponse (`after`) : une panne du fournisseur
// d'e-mails ne fait jamais échouer la déclaration, elle est notée (`ack_error`) et le
// cron réessaie. La réponse ne dit rien des commandes de la personne : on ne révèle
// pas si cet e-mail a acheté.

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = ["fr", "en"] as const;

/** Envois au plus par IP et par heure, en plus des 5 par minute du limiteur commun. */
const HOURLY_LIMIT = 12;

export async function POST(request: Request) {
  // Appelée par nos pages seulement (mêmes gardes que la route de paiement).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return apiError(403, "invalidRequest", "Requête invalide.");
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return apiError(415, "invalidRequest", "Requête invalide.");
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }

  const ip = getClientIp(request);
  const perMinute = await checkFormRateLimit(ip, "retractation");
  const perHour = perMinute.allowed
    ? await checkRateLimit(ip, "retractation:h", { limit: HOURLY_LIMIT, windowSeconds: 3600 })
    : perMinute;
  if (!perHour.allowed) {
    return apiError(429, "rateLimited", "Trop de tentatives. Réessaie dans un moment.", {
      headers: { "Retry-After": String(perHour.retryAfter) },
    });
  }

  const nom = textField(body.nom);
  const email = textField(body.email);
  const commande = textField(body.commande);
  const details = textField(body.details);
  if (nom === null || email === null || commande === null || details === null) {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }
  if (!nom || !email) return apiError(400, "missingFields", "Champs obligatoires manquants.");
  // Les longueurs AVANT l'expression régulière : elle ne doit jamais voir une chaîne géante.
  const tooLong = findTooLong({ nom, email, commande, details });
  if (tooLong) {
    return apiError(422, "tooLong", tooLongMessage(tooLong), {
      params: { field: tooLong, max: FIELD_MAX[tooLong] },
    });
  }
  if (!EMAIL.test(email)) return apiError(422, "invalidEmail", "Adresse email invalide.");

  // Envoi trop rapide pour un humain : refusé (le client peut réessayer). Piège rempli :
  // la déclaration est GARDÉE, marquée suspecte, sans accusé automatique.
  const { spam, tooFast } = checkSpam(body);
  if (tooFast) return apiError(429, "tooFast", "Envoi trop rapide, réessaie dans un instant.");

  const locale = LOCALES.find((l) => l === body.locale) ?? "fr";
  const admin = createAdminClient();

  // Commandes PAYÉES de cette adresse. Le motif ne tolère aucun joker, et on ne garde
  // ensuite que les adresses EXACTEMENT identiques (casse mise à part).
  const { data: candidates, error: ordersError } = await admin
    .from("orders")
    .select("id, customer_email")
    .in("status", ["paid", "fulfilled"])
    .ilike("customer_email", emailLikePattern(email))
    .order("created_at", { ascending: false })
    .limit(50);
  if (ordersError) {
    // Pas de rapprochement possible ne doit pas coûter sa déclaration au client :
    // on l'enregistre « non rapprochée », le staff la traitera à la main.
    console.error("[retractation] lecture des commandes:", ordersError.message);
  }
  const orders = ((candidates ?? []) as { id: string; customer_email: string | null }[]).filter((o) =>
    sameEmail(o.customer_email, email),
  );
  const matched = ordersError ? { orderId: null, match: "none" as const } : matchOrder(orders, commande || null);

  const { data, error } = await admin
    .from("order_withdrawals")
    .insert({
      order_id: matched.orderId,
      // Ce que le client a tapé, TEL QUEL : fait partie de sa déclaration (rappelé dans l'accusé).
      order_number: commande || null,
      match: matched.match,
      customer_name: nom,
      customer_email: email,
      details: details || null,
      locale,
      mailbox_key: mailboxKey(email),
      suspect: spam,
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
