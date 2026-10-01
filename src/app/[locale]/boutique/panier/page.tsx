import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import CartView, { type CartProduct } from "@/components/CartView";
import ClientMessages from "@/components/ClientMessages";
import { getProducts } from "@/lib/boutique";
import { shippingEuros } from "@/lib/shop";
import { pageMetadata } from "@/lib/site";
import { isStripeConfigured } from "@/lib/stripe";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  // Un panier est propre à chaque visiteur : rien à indexer.
  return pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/boutique/panier",
    locale,
    noindex: true,
  });
}

// Même cache que la boutique (catalogue public, invalidé à chaque vente et à
// chaque modification du back-office) : le panier lui-même vit dans le
// navigateur, la page ne porte que le catalogue nécessaire pour l'afficher.
// Le stock réel est revérifié en base au moment de payer.
export const dynamic = "force-static";
export const revalidate = 3600;

export default async function CartPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cart" });

  // Le strict nécessaire au panier : pas de description, pas de catégorie.
  const products: CartProduct[] = (await getProducts(locale)).map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    image: p.image,
    icon: p.icon,
    available: p.available,
    variants: p.variants,
  }));

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-32">
      <h1 className="mb-10 text-center font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(220,37,21,0.4)] sm:text-5xl">
        {t("title")}
      </h1>
      <ClientMessages locale={locale} clients={["CartView"]}>
        <CartView products={products} shipping={shippingEuros()} open={isStripeConfigured()} />
      </ClientMessages>
    </div>
  );
}
