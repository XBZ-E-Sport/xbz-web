import Link from "next/link";
import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité — XBZ Esport",
  description:
    "Comment XBZ Esport collecte, utilise, conserve et protège tes données personnelles (recrutement et support), et comment exercer tes droits RGPD.",
  alternates: { canonical: "/confidentialite" },
};

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;
const MAIL = process.env.NEXT_PUBLIC_MAIL ?? "";

// Durée de conservation appliquée par la purge automatique (/api/cron/purge).
const RETENTION_MONTHS = 24;

const h2Cls = "mb-3 font-display text-xl font-bold text-white sm:text-2xl";
const liCls = "ml-5 list-disc marker:text-xbz-cyan";

function ContactLink() {
  if (DISCORD_URL) {
    return (
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-xbz-cyan hover:underline"
      >
        le serveur Discord officiel
      </a>
    );
  }
  return <span>le serveur Discord officiel</span>;
}

export default function ConfidentialitePage() {
  return (
    <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32">
      <header className="mb-12 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Légal
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Politique de confidentialité
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance leading-relaxed text-neutral-400">
          Cette page explique quelles données {siteConfig.name} collecte via ses formulaires,
          pourquoi, combien de temps elles sont conservées, et comment exercer tes droits.
        </p>
      </header>

      <div className="space-y-10 leading-relaxed text-neutral-300">
        <section aria-labelledby="responsable">
          <h2 id="responsable" className={h2Cls}>
            Responsable du traitement
          </h2>
          <p>
            Les données collectées sur ce site sont traitées par la structure esport{" "}
            {siteConfig.name}. Pour toute question relative à tes données, contacte-nous via{" "}
            <ContactLink />
            {MAIL ? (
              <>
                {" "}ou par email à{" "}
                <a href={`mailto:${MAIL}`} className="font-semibold text-xbz-cyan hover:underline">
                  {MAIL}
                </a>
              </>
            ) : null}
            .
          </p>
        </section>

        <section aria-labelledby="donnees">
          <h2 id="donnees" className={h2Cls}>
            Données collectées
          </h2>
          <p>Nous ne collectons que les informations que tu renseignes volontairement :</p>
          <ul className="mt-3 space-y-1.5">
            <li className={liCls}>
              <strong className="text-neutral-200">Formulaire de recrutement</strong> : catégorie,
              rôle souhaité, nom et prénom, âge, pays de résidence, pseudo Discord, pseudo, jeu,
              lien RL Tracker (facultatif), expérience et motivation (facultatifs), roster souhaité
              (facultatif).
            </li>
            <li className={liCls}>
              <strong className="text-neutral-200">Formulaire de support</strong> : nom ou pseudo,
              adresse email, sujet et contenu de ton message.
            </li>
          </ul>
          <p className="mt-3">
            Aucune donnée sensible n’est demandée. Nous n’utilisons ni cookie publicitaire ni
            traceur (voir les{" "}
            <Link href="/mentions-legales" className="font-semibold text-xbz-cyan hover:underline">
              mentions légales
            </Link>
            ).
          </p>
        </section>

        <section aria-labelledby="finalites">
          <h2 id="finalites" className={h2Cls}>
            Finalités &amp; base légale
          </h2>
          <p>
            Ces données servent uniquement à <strong>traiter ta candidature</strong> ou à{" "}
            <strong>répondre à ta demande de support</strong>, et à te recontacter à ce sujet.
          </p>
          <p className="mt-2">
            La base légale du traitement est ton <strong>consentement</strong> (article 6.1.a du
            RGPD), recueilli via la case à cocher présente sur chaque formulaire. Ce consentement
            est horodaté au moment de l’envoi.
          </p>
        </section>

        <section aria-labelledby="duree">
          <h2 id="duree" className={h2Cls}>
            Durée de conservation
          </h2>
          <p>
            Tes données sont conservées <strong>{RETENTION_MONTHS} mois</strong> à compter de leur
            envoi, puis <strong>supprimées automatiquement</strong>. Tu peux demander leur
            suppression à tout moment avant ce délai (voir « Tes droits »).
          </p>
        </section>

        <section aria-labelledby="destinataires">
          <h2 id="destinataires" className={h2Cls}>
            Destinataires &amp; hébergement
          </h2>
          <p>
            Tes données sont accessibles au seul staff de {siteConfig.name} habilité à traiter les
            candidatures et le support. Elles ne sont <strong>ni revendues ni cédées</strong> à des
            tiers à des fins commerciales.
          </p>
          <p className="mt-2">Pour fonctionner, le site s’appuie sur des prestataires techniques :</p>
          <ul className="mt-3 space-y-1.5">
            <li className={liCls}>
              <strong className="text-neutral-200">Supabase</strong> — hébergement de la base de
              données où sont stockées les candidatures et messages.
            </li>
            <li className={liCls}>
              <strong className="text-neutral-200">Vercel</strong> — hébergement du site et
              mesure d’audience anonyme (statistiques de visite agrégées, sans cookie ni
              traçage individuel).
            </li>
            <li className={liCls}>
              <strong className="text-neutral-200">Discord</strong> — une notification interne est
              envoyée au staff sur le serveur de la structure à la réception d’un formulaire.
            </li>
          </ul>
        </section>

        <section aria-labelledby="droits">
          <h2 id="droits" className={h2Cls}>
            Tes droits
          </h2>
          <p>
            Conformément au RGPD, tu disposes d’un droit d’accès, de rectification, d’effacement,
            de limitation et d’opposition au traitement, d’un droit à la portabilité, ainsi que du
            droit de retirer ton consentement à tout moment.
          </p>
          <p className="mt-2">
            Pour exercer ces droits, contacte-nous via <ContactLink />
            {MAIL ? (
              <>
                {" "}ou à{" "}
                <a href={`mailto:${MAIL}`} className="font-semibold text-xbz-cyan hover:underline">
                  {MAIL}
                </a>
              </>
            ) : null}
            . Nous te répondrons dans les meilleurs délais.
          </p>
          <p className="mt-2">
            Tu peux également introduire une réclamation auprès de la CNIL —{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-xbz-cyan hover:underline"
            >
              cnil.fr
            </a>
            .
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
