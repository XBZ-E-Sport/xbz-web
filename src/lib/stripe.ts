import "server-only";

import Stripe from "stripe";

import { legalReady } from "@/lib/legal";

// Client Stripe, CÔTÉ SERVEUR UNIQUEMENT.
//
// Paiement par Checkout HÉBERGÉ : le client paie sur une page de Stripe.
// Aucun script Stripe ne tourne sur nos pages, aucune clé n'atteint le
// navigateur (pas de NEXT_PUBLIC_*), la CSP reste inchangée.
//
// Instancié paresseusement : au build (prérendu), `STRIPE_SECRET_KEY` peut
// manquer ; on ne crée le client qu'au premier appel réel.

let client: Stripe | null = null;

/**
 * Faux Stripe local pour les tests de bout en bout (`STRIPE_MOCK_URL`).
 * Ignoré en production : impossible de détourner les paiements réels par une
 * variable d'environnement.
 */
function mockEndpoint(): { host: string; port: number; protocol: "http" | "https" } | null {
  const raw = process.env.NODE_ENV === "production" ? undefined : process.env.STRIPE_MOCK_URL;
  if (!raw) return null;
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    protocol: url.protocol === "https:" ? "https" : "http",
  };
}

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY manquante : la boutique ne peut pas encaisser.");
    client = new Stripe(key, {
      // Version d'API épinglée : celle que fige le SDK installé (22.6.x). Le
      // type `apiVersion` n'accepte qu'elle : SDK et version avancent ensemble.
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
      maxNetworkRetries: 2,
      ...mockEndpoint(),
    });
  }
  return client;
}

/**
 * La clé secrète est-elle une clé LIVE (vrais paiements) ? Une clé de test
 * commence par `sk_test_` (ou `rk_test_` pour une clé restreinte).
 */
export function isLiveStripeKey(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

/** La boutique encaisse : clé secrète ET secret du webhook configurés. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * La boutique accepte-t-elle des commandes ? Stripe branché ET, si c'est une
 * clé LIVE, les obligations légales en place (voir `legalMissing`). Les pages
 * (fiche produit, panier) s'appuient dessus pour ne pas proposer d'acheter ce
 * que la route de paiement refuserait ensuite.
 */
export function isShopOpen(): boolean {
  return isStripeConfigured() && (!isLiveStripeKey() || legalReady());
}

/** Lien vers un paiement dans le tableau de bord Stripe (mode test compris). */
export function stripeDashboardUrl(paymentIntent: string): string {
  const test = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}payments/${encodeURIComponent(paymentIntent)}`;
}
