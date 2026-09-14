"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { getProductForCheckout } from "@/lib/boutique";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { siteConfig, localizedPath } from "@/lib/site";

// Pays où l'on accepte de livrer. Stripe collecte l'adresse et refuse les
// autres. Volontairement restreint à la zone où l'expédition est réaliste
// (France + voisins francophones/limitrophes) ; à élargir quand la logistique
// suit.
const SHIPPING_COUNTRIES = ["FR", "BE", "LU", "CH", "MC", "DE", "ES", "IT", "NL", "PT"] as const;

/** Frais de port fixes, en centimes. Réglable via SHIPPING_FLAT_EUR. */
function shippingCents(): number {
  const euros = Number(process.env.SHIPPING_FLAT_EUR ?? "4.90");
  return Number.isFinite(euros) && euros >= 0 ? Math.round(euros * 100) : 490;
}

/**
 * Crée une session Stripe Checkout pour UN produit et redirige vers la page de
 * paiement hébergée par Stripe.
 *
 * Rien de sensible ne transite par le navigateur : le formulaire n'envoie que
 * le slug, le prix est relu en base, et Stripe gère cartes, 3D Secure, adresse
 * de livraison et reçu. Au retour, la page /boutique/merci confirme — mais la
 * commande, elle, n'est enregistrée que par le webhook signé.
 */
export async function createCheckoutSession(formData: FormData) {
  const locale = await getLocale();
  const boutique = localizedPath("/boutique", locale);

  // Boutique pas encore branchée à Stripe (avant-lancement) : on renvoie
  // proprement plutôt que de planter.
  if (!isStripeConfigured()) redirect(`${boutique}?erreur=indisponible`);

  const slug = String(formData.get("slug") ?? "").trim();
  const product = slug ? await getProductForCheckout(slug, locale) : null;
  if (!product) redirect(`${boutique}?erreur=introuvable`);

  const origin = (await headers()).get("origin") ?? siteConfig.url;

  let checkoutUrl: string | null = null;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: locale === "en" ? "en" : "fr",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: product.priceCents,
            product_data: { name: product.name },
          },
        },
      ],
      // Stripe collecte l'adresse de livraison et applique le port.
      shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: shippingCents(), currency: "eur" },
            display_name: locale === "en" ? "Standard shipping" : "Livraison standard",
          },
        },
      ],
      // Le webhook relit le slug ici pour reconstituer la commande.
      metadata: { product_slug: slug },
      success_url: `${origin}${boutique}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${boutique}?annule=1`,
    });
    checkoutUrl = session.url;
  } catch (e) {
    console.error("[boutique] création session Stripe:", e);
    redirect(`${boutique}?erreur=paiement`);
  }

  if (!checkoutUrl) redirect(`${boutique}?erreur=paiement`);
  // Redirection HORS du try : `redirect()` lève une exception de contrôle
  // qu'un catch avalerait.
  redirect(checkoutUrl);
}
