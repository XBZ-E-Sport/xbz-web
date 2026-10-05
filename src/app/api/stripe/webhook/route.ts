import type Stripe from "stripe";

import { recordPayment, recordRefund, releaseFromSession } from "@/lib/shop";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Webhook Stripe : LE point de vérité d'une vente.
//
// Une commande n'est confirmée QUE d'ici, jamais depuis la page de retour :
// le retour peut être forgé ou ne jamais arriver (onglet fermé), alors que ce
// webhook est signé par Stripe et rejoué jusqu'à réception d'un 200.
//
// Événements à cocher sur l'endpoint, dans le tableau de bord Stripe :
//   checkout.session.completed                 payé (carte)
//   checkout.session.async_payment_succeeded   payé plus tard (par sécurité)
//   checkout.session.async_payment_failed      paiement refusé → stock rendu
//   checkout.session.expired                   abandonné → stock rendu
//   charge.refunded                            remboursé depuis Stripe
//
// Hors du proxy i18n (le matcher exclut `/api`) : URL fixe, sans langue.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// L'e-mail de confirmation part après la réponse (`after`) : lui laisser le temps de finir.
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET manquante — webhook ignoré.");
    return new Response("webhook non configuré", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("signature absente", { status: 400 });

  // CORPS BRUT : la signature couvre les octets exacts reçus.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    console.warn("[stripe] signature webhook invalide:", e instanceof Error ? e.message : e);
    return new Response("signature invalide", { status: 400 });
  }

  const admin = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        // `completed` arrive aussi pour un paiement encore en cours : non
        // payé, on attend la suite (rien n'est rendu, rien n'est confirmé).
        await recordPayment(admin, event.data.object);
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await releaseFromSession(admin, event.data.object);
        break;
      case "charge.refunded":
        await recordRefund(admin, event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    // 500 : Stripe réessaiera ; chaque traitement est idempotent.
    console.error(`[stripe] ${event.type} :`, e);
    return new Response("erreur interne", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
