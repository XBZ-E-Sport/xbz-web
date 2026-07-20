import Link from "next/link";
import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales — XBZ Esport",
  description: "Mentions légales et informations sur l'éditeur du site XBZ Esport.",
};

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

const h2Cls = "mb-3 font-display text-xl font-bold text-white sm:text-2xl";

// NB : les champs entre crochets « [ … ] » sont à compléter par XBZ (nom du
// responsable de publication, éventuelle adresse). L'hébergeur ci-dessous
// correspond à un déploiement Vercel — à adapter si l'hébergement change.
export default function MentionsLegalesPage() {
  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <header className="mb-12 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Légal
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Mentions légales
        </h1>
      </header>

      <div className="space-y-10 leading-relaxed text-neutral-300">
        <section aria-labelledby="editeur">
          <h2 id="editeur" className={h2Cls}>
            Éditeur du site
          </h2>
          <p>
            Le site {siteConfig.name} est édité par la structure esport {siteConfig.name}.
          </p>
          <p className="mt-2">
            Responsable de la publication :{" "}
            <span className="text-neutral-500">[nom du responsable à compléter]</span>.
          </p>
          <p className="mt-2">
            Contact :{" "}
            {DISCORD_URL ? (
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-xbz-cyan hover:underline"
              >
                via le serveur Discord officiel
              </a>
            ) : (
              "via le serveur Discord officiel"
            )}
            .
          </p>
        </section>

        <section aria-labelledby="hebergement">
          <h2 id="hebergement" className={h2Cls}>
            Hébergement
          </h2>
          <p>
            Ce site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789,
            États-Unis —{" "}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-xbz-cyan hover:underline"
            >
              vercel.com
            </a>
            .
          </p>
        </section>

        <section aria-labelledby="propriete">
          <h2 id="propriete" className={h2Cls}>
            Propriété intellectuelle
          </h2>
          <p>
            L’ensemble des contenus présents sur ce site (textes, logo, visuels, mise en page)
            est la propriété de {siteConfig.name}, sauf mention contraire. Toute reproduction ou
            réutilisation, totale ou partielle, sans autorisation préalable est interdite.
          </p>
        </section>

        <section aria-labelledby="donnees">
          <h2 id="donnees" className={h2Cls}>
            Données personnelles
          </h2>
          <p>
            Les formulaires de recrutement et de support collectent uniquement les informations
            que tu renseignes, dans le seul but de traiter ta demande. Ces données ne sont ni
            revendues ni cédées à des tiers.
          </p>
          <p className="mt-2">
            Conformément au RGPD, tu peux demander l’accès, la rectification ou la suppression de
            tes données en nous contactant via le Discord de la structure.
          </p>
        </section>

        <section aria-labelledby="cookies">
          <h2 id="cookies" className={h2Cls}>
            Cookies
          </h2>
          <p>
            Le site n’utilise pas de cookies publicitaires ou de traçage. Seuls des cookies
            techniques nécessaires au fonctionnement (session d’authentification de l’espace
            back-office) peuvent être déposés.
          </p>
        </section>
      </div>

      <p className="mt-12 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
        >
          <span aria-hidden="true">←</span> Retour à l’accueil
        </Link>
      </p>
    </div>
  );
}
