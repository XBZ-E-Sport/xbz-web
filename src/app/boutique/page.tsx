import Image from "next/image";

import { getProducts, type Product, type ProductCategory } from "@/lib/boutique";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";

export const metadata = {
  title: "Boutique — XBZ Esport",
  description:
    "La boutique officielle XBZ Esport : maillots, textile et accessoires aux couleurs du club.",
  alternates: { canonical: "/boutique" },
};

// Produits lus en base à chaque visite (pilotés par le back-office).
export const dynamic = "force-dynamic";

const categoryStyles: Record<ProductCategory, string> = {
  Textile: "bg-xbz-blue/15 text-[#7fc8ff]",
  Accessoire: "bg-[rgba(160,90,255,0.15)] text-[#c9a7ff]",
  Gaming: "bg-[rgba(0,200,255,0.15)] text-[#7fe6ff]",
};

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export default async function BoutiquePage() {
  const products = await getProducts();
  // Bandeau « ouvre bientôt » tant qu'aucun produit n'est achetable.
  const anyAvailable = products.some((p) => p.available);

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      {/* En-tête */}
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Boutique
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          La boutique XBZ
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          Le merch officiel aux couleurs du club. Textile, accessoires et goodies pour porter
          les couleurs XBZ.
        </p>
      </header>

      {/* Bandeau ouverture prochaine (tant qu'aucun produit n'est achetable) */}
      {!anyAvailable && (
        <p
          role="status"
          className="mx-auto mb-12 flex max-w-xl items-center justify-center gap-2 rounded-xl border border-xbz-cyan/30 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-xbz-cyan"
        >
          <span aria-hidden="true">🛒</span>
          La boutique ouvre bientôt — voici un aperçu de la collection.
        </p>
      )}

      {products.length === 0 ? (
        <p className="card-xbz p-10 text-center text-neutral-400">
          Aucun produit pour le moment. Reviens vite !
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </ul>
      )}

      {/* CTA */}
      <div className="card-xbz mt-16 p-8 text-center sm:p-10">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Sois prévenu de l’ouverture
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-neutral-300">
          Rejoins le Discord pour être notifié dès que la boutique est en ligne, et ne rate
          aucun drop.
        </p>
        <div className="mt-7 flex justify-center">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#5865F2] px-8 py-3.5 text-center font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
          >
            Rejoindre le Discord
            <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <li className="card-xbz flex flex-col overflow-hidden">
      {/* Visuel : image produit si dispo, sinon emoji de repli */}
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-linear-to-br from-xbz-blue/20 to-xbz-cyan/10">
        {product.image ? (
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span aria-hidden="true" className="text-6xl">
            {product.icon}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${categoryStyles[product.category]}`}
          >
            {product.category}
          </span>
          <span className="font-display text-lg font-bold text-white">
            {priceFormatter.format(product.price)}
          </span>
        </div>

        <h3 className="mt-3 font-display text-lg text-xbz-blue">{product.name}</h3>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
          {product.description}
        </p>

        <div className="mt-4">
          {product.available ? (
            // Achetable : lien d'achat externe s'il existe, sinon commande via Discord.
            <a
              href={product.url || DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-xbz-blue px-4 py-2 text-center text-sm font-bold text-white transition hover:brightness-110"
            >
              {product.url ? "Acheter" : "Commander sur Discord"}
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          ) : (
            <span className="block rounded-lg border border-white/15 px-4 py-2 text-center text-sm font-semibold text-neutral-400">
              Bientôt disponible
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
