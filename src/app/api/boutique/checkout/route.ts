import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { CHECKOUT_OPEN_COOKIE, parseCheckoutLines } from "@/lib/cart";
import { checkRateLimit, getClientIp, rateLimitKey } from "@/lib/ratelimit";
import {
  CHECKOUT_COOKIE,
  RESERVATION_MINUTES,
  abandonOrder,
  buildCheckoutParams,
  reserveOrder,
  sweepStaleReservations,
} from "@/lib/shop";
import { liveBlockers } from "@/lib/go-live";
import { formatEuros } from "@/lib/money";
import { printText } from "@/lib/personalization";
import { withdrawalTableReady } from "@/lib/withdrawal-server";
import { isLiveStripeKey, isStripeConfigured, stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, localizedPath } from "@/lib/site";

// « Payer » : réserve le stock, ouvre la page de paiement Stripe, renvoie son
// adresse. Le navigateur n'envoie QUE des tailles et des quantités ; prix,
// noms et disponibilités sont relus en base.
//
// Codes d'erreur (champ `code`, traduits par la page panier) :
//   unavailable 503  boutique pas encore branchée à Stripe
//   forbidden   403  appel venu d'un autre site
//   rateLimited 429  trop de tentatives
//   invalid     400  panier mal formé
//   terms       422  CGV non acceptées
//   stock       409  une ou plusieurs tailles plus disponibles (`unavailable`)
//   personalization 422  personnalisation refusée (produit qui ne la propose plus, texte invalide)
//   payment     502  Stripe n'a pas pu ouvrir la page de paiement

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, code, ...extra }, { status });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // Réservé aux pages du site : un autre site ne doit pas pouvoir bloquer du
  // stock au nom d'un visiteur. JSON exigé (pas de formulaire « simple »
  // envoyé d'ailleurs sans pré-vol CORS).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return fail(403, "forbidden");
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "invalid");

  if (!isStripeConfigured()) return fail(503, "unavailable");
  // Vrais paiements : pas sans les obligations légales du e-commerce (médiateur
  // de la consommation, téléphone, rétractation en ligne, envoi des accusés de
  // réception : voir `liveBlockers`). La clé de test, elle, n'est pas concernée.
  if (isLiveStripeKey()) {
    const missing = liveBlockers();
    // La fonction de rétractation ne peut rien enregistrer si la migration n'est pas passée.
    if (missing.length === 0 && !(await withdrawalTableReady(createAdminClient()))) {
      missing.push("table order_withdrawals absente (migration supabase/migration_retractation_05102026.sql non passée)");
    }
    if (missing.length > 0) {
      console.error(`[boutique] paiement live refusé : ${missing.join(" ; ")}.`);
      return fail(503, "unavailable");
    }
  }

  let body: { lines?: unknown; locale?: unknown; terms?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const lines = parseCheckoutLines(body.lines);
  if (!lines) return fail(400, "invalid");
  if (body.terms !== true) return fail(422, "terms");
  const locale = body.locale === "en" ? "en" : "fr";

  // Chaque tentative réserve du stock pendant 30 min : sans limite, un seul
  // visiteur pourrait bloquer toute une collection. 10 par quart d'heure par
  // abonné, 30 par /48 en IPv6 (même logique que les formulaires).
  const ip = getClientIp(request);
  const limited = await checkRateLimit(ip, "checkout", { limit: 10, windowSeconds: 900 });
  if (!limited.allowed) return fail(429, "rateLimited", { retryAfter: limited.retryAfter });
  if (rateLimitKey(ip).endsWith("::/64")) {
    const net = await checkRateLimit(ip, "checkout:net", { limit: 30, windowSeconds: 900, prefix: 48 });
    if (!net.allowed) return fail(429, "rateLimited", { retryAfter: net.retryAfter });
  }

  const admin = createAdminClient();
  const jar = await cookies();

  // Ce navigateur avait déjà une commande en attente (retour en arrière depuis
  // Stripe, panier modifié) : on la ferme et on rend son stock avant d'en
  // réserver une nouvelle.
  const previous = jar.get(CHECKOUT_COOKIE)?.value;
  if (previous && UUID.test(previous)) await abandonOrder(admin, previous).catch(() => false);

  // Filet : réservations dépassées dont le webhook se serait perdu.
  after(() => sweepStaleReservations(admin).catch(() => 0));

  const reserved = await reserveOrder(admin, lines, locale);
  if (!reserved.ok) {
    if (reserved.reason === "stock") return fail(409, "stock", { unavailable: reserved.unavailable });
    if (reserved.reason === "invalid") return fail(400, "invalid");
    if (reserved.reason === "personalization") return fail(422, "personalization");
    return fail(502, "payment");
  }
  const { order } = reserved;

  const t = await getTranslations({ locale, namespace: "checkout" });
  let url: string | null = null;
  try {
    const session = await stripe().checkout.sessions.create(
      buildCheckoutParams(order, {
        size: (size) => t("size", { size }),
        print: (p) => {
          const text = printText(p, t("printNumber"));
          return p.extra > 0
            ? t("print", { text, extra: formatEuros(p.extra / 100, locale) })
            : t("printFree", { text });
        },
        shipping: t("shipping"),
        submit: t("submit", { url: absoluteUrl(localizedPath("/cgv", locale)) }),
      }),
      // Rejouée par le SDK en cas de coupure : une seule page pour une commande.
      { idempotencyKey: `checkout-${order.id}` },
    );
    url = session.url;
    const { error } = await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[boutique] création de la page de paiement:", e);
    await abandonOrder(admin, order.id).catch(() => false);
    return fail(502, "payment");
  }
  if (!url) {
    await abandonOrder(admin, order.id).catch(() => false);
    return fail(502, "payment");
  }

  const cookie = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: (RESERVATION_MINUTES + 30) * 60,
  } as const;
  jar.set(CHECKOUT_COOKIE, order.id, { ...cookie, httpOnly: true });
  jar.set(CHECKOUT_OPEN_COOKIE, "1", cookie);
  return NextResponse.json({ ok: true, url });
}
