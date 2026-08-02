import { getProducts } from "@/lib/boutique";
import BoutiqueList from "@/components/BoutiqueList";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";

export const metadata = {
  title: "Boutique — XBZ Esport",
  description:
    "La boutique officielle XBZ Esport : maillots, textile et accessoires aux couleurs du club.",
  alternates: { canonical: "/boutique" },
};

// Produits lus en base à chaque visite (pilotés par le back-office).
export const dynamic = "force-dynamic";

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
        <BoutiqueList products={products} />
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
