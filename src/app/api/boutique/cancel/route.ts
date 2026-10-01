import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { CHECKOUT_OPEN_COOKIE } from "@/lib/cart";
import { CHECKOUT_COOKIE, abandonOrder } from "@/lib/shop";
import { isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Retour sur le panier après avoir ouvert une page de paiement (« Annuler »
// sur Stripe, ou simple retour arrière) : la page panier appelle cette route
// pour rendre tout de suite le stock réservé — sans attendre les 30 min de la
// réservation. Seule la commande de CE navigateur (cookie httpOnly) est visée ;
// une commande déjà payée n'est jamais touchée (voir abandonOrder).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return NextResponse.json({ ok: false }, { status: 403 });

  const jar = await cookies();
  const orderId = jar.get(CHECKOUT_COOKIE)?.value;
  jar.delete(CHECKOUT_OPEN_COOKIE);
  if (!orderId || !UUID.test(orderId) || !isStripeConfigured()) return NextResponse.json({ ok: true, released: false });

  const released = await abandonOrder(createAdminClient(), orderId).catch(() => false);
  jar.delete(CHECKOUT_COOKIE);
  return NextResponse.json({ ok: true, released });
}
