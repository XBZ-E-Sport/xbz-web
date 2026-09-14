import "server-only";

import Stripe from "stripe";

// Client Stripe, CÔTÉ SERVEUR UNIQUEMENT.
//
// La clé `STRIPE_SECRET_KEY` ne doit jamais atteindre le navigateur (pas de
// préfixe NEXT_PUBLIC_). Avec le Checkout hébergé, aucun JS Stripe ne tourne
// côté client : cette clé secrète suffit à tout le flux d'achat, et rien de
// sensible n'est exposé à la page — c'est ce qui garde la CSP inchangée.
//
// Instancié paresseusement : au build (prérendu), `STRIPE_SECRET_KEY` peut être
// absente. On ne crée le client qu'au premier appel réel (action d'achat,
// webhook), pas à l'import — sinon le build planterait comme il l'a fait pour
// Supabase.

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY manquante : la boutique ne peut pas créer de paiement.",
      );
    }
    client = new Stripe(key, {
      // Version d'API épinglée : Stripe fait évoluer ses réponses, on choisit
      // explicitement le contrat plutôt que de suivre les changements au hasard.
      // On la cale sur la version que fige le SDK installé (`stripe` 22.6.x) :
      // le type `apiVersion` du SDK n'accepte que celle-là, donc les deux
      // avancent ensemble à chaque montée de version.
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
    });
  }
  return client;
}

/** Vrai quand la boutique est réellement branchée à Stripe (prod configurée). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
