import { after } from "next/server";

import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Webhook Stripe : LE point de vérité d'une vente.
//
// Une commande n'est enregistrée QUE d'ici, jamais depuis la page de retour :
// le retour d'URL peut être forgé ou n'arriver jamais (onglet fermé), alors que
// ce webhook est signé par Stripe et rejoué jusqu'à réception d'un 200.
//
// Cette route vit hors du proxy i18n (matcher exclut `/api`) : Stripe l'appelle
// à une URL fixe, sans langue.

// Node, pas Edge : la vérification de signature utilise le module crypto.
export const runtime = "nodejs";
// Jamais mise en cache : chaque appel est un événement distinct.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET manquante — webhook ignoré.");
    return new Response("webhook non configuré", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("signature absente", { status: 400 });

  // CORPS BRUT obligatoire : la signature couvre les octets exacts reçus. Un
  // `request.json()` re-sérialiserait et invaliderait la vérification.
  const payload = await request.text();

  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    // Signature invalide → ce n'est pas Stripe. On refuse sans rien enregistrer.
    console.warn("[stripe] signature webhook invalide:", e instanceof Error ? e.message : e);
    return new Response("signature invalide", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      await recordOrder(event.data.object.id);
    } catch (e) {
      // On renvoie 500 : Stripe réessaiera, et l'idempotence évite le doublon.
      console.error("[stripe] enregistrement commande échoué:", e);
      return new Response("erreur interne", { status: 500 });
    }
  }

  // 200 rapide pour tout le reste : Stripe cesse de réessayer un événement
  // qu'on a bien reçu, même si on ne le traite pas.
  return new Response(null, { status: 200 });
}

/**
 * Reconstitue la commande à partir de la session Stripe et l'écrit une seule
 * fois (idempotent sur `stripe_session_id`). Notifie le staff en arrière-plan.
 */
async function recordOrder(sessionId: string): Promise<void> {
  // On relit la session complète (les articles ne sont pas inclus dans
  // l'événement) — source d'autorité pour le montant réellement encaissé.
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  // Paiement pas abouti (méthode asynchrone en attente, abandon) : on n'écrit
  // pas de commande « payée ».
  if (session.payment_status !== "paid") return;

  const shipping = session.collected_information?.shipping_details ?? null;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const lineItems = (session.line_items?.data ?? []).map((li) => ({
    name: li.description,
    quantity: li.quantity ?? 1,
    amount_cents: li.amount_total, // total de la ligne, en centimes
  }));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .upsert(
      {
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntent,
        status: "paid",
        // Centimes → euros pour la colonne `numeric`.
        amount_total: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "eur",
        customer_email: session.customer_details?.email ?? null,
        customer_name: shipping?.name ?? session.customer_details?.name ?? null,
        shipping_address: shipping?.address ?? session.customer_details?.address ?? null,
        line_items: lineItems,
        paid_at: new Date().toISOString(),
      },
      // Rejoué par Stripe → on ignore un doublon plutôt que de le dédupliquer
      // à la main. `data` reste vide si la ligne existait déjà.
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return; // déjà enregistrée : ne pas re-notifier

  notifyStaff(session.customer_details?.email ?? "client", (session.amount_total ?? 0) / 100);
}

/** Notifie le staff qu'une commande est tombée (Discord, best-effort). */
function notifyStaff(email: string, amountEur: number): void {
  const botUrl = process.env.BOT_SUPPORT_URL;
  if (!botUrl) return;
  after(async () => {
    try {
      await fetch(botUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.BOT_SHARED_SECRET
            ? { "x-xbz-secret": process.env.BOT_SHARED_SECRET }
            : {}),
        },
        body: JSON.stringify({
          nom: "Nouvelle commande boutique",
          email,
          sujet: "Commande",
          message: `Commande payée : ${amountEur.toFixed(2)} € — ${email}`,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (e) {
      console.error("[stripe] notif commande échouée:", e);
    }
  });
}
