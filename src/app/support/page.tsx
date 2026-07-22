import Link from "next/link";

import SupportForm from "@/components/SupportForm";
import { jsonLdString } from "@/lib/jsonld";

export const metadata = {
  title: "Support — XBZ Esport",
  description: "Besoin d’aide ? Contacte le staff XBZ via Discord, email ou le formulaire de contact.",
  alternates: { canonical: "/support" },
};

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "#";
const MAIL = process.env.NEXT_PUBLIC_MAIL ?? "";

const demandes = [
  {
    icon: "📝",
    title: "Recrutement",
    text: "Rejoindre une équipe ou le staff.",
    href: "/recrutement",
  },
  {
    icon: "🤝",
    title: "Partenariat",
    text: "Sponsoring & collaborations.",
    href: `mailto:${MAIL}?subject=${encodeURIComponent("Partenariat — XBZ")}`,
  },
  {
    icon: "🚨",
    title: "Signalement",
    text: "Signaler un comportement au staff.",
    href: DISCORD_URL,
  },
  {
    icon: "📣",
    title: "Presse & média",
    text: "Demandes presse et interviews.",
    href: `mailto:${MAIL}?subject=${encodeURIComponent("Presse — XBZ")}`,
  },
];

const faq = [
  {
    q: "Comment rejoindre XBZ ?",
    a: "Rends-toi sur la page Recrutement et remplis le formulaire. Le staff étudie chaque candidature avec attention.",
  },
  {
    q: "Comment suivre ma candidature ?",
    a: "Le staff te recontacte via Discord : veille à indiquer un pseudo Discord correct dans ta candidature.",
  },
  {
    q: "Sur quels jeux XBZ est-il actif ?",
    a: "La structure est actuellement active sur Rocket League.",
  },
  {
    q: "Comment devenir partenaire ou sponsor ?",
    a: "Contacte-nous par email avec ta proposition : on revient vers toi rapidement.",
  },
  {
    q: "Comment signaler un comportement ?",
    a: "Préviens un membre du staff directement sur le Discord du club.",
  },
  {
    q: "La boutique est-elle ouverte ?",
    a: "Elle ouvre bientôt. Rejoins le Discord pour être notifié dès la mise en ligne.",
  },
];

// JSON-LD FAQPage (SEO : rich results Google sur les questions fréquentes).
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

function DemandeCard({ demande }: { demande: (typeof demandes)[number] }) {
  const inner = (
    <>
      <span aria-hidden="true" className="text-2xl leading-none">
        {demande.icon}
      </span>
      <div>
        <h3 className="font-display text-base text-xbz-blue">{demande.title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">{demande.text}</p>
      </div>
    </>
  );
  const cls =
    "card-xbz flex h-full items-start gap-3 p-5 transition duration-300 hover:border-xbz-blue/40 motion-safe:hover:-translate-y-1";

  if (demande.href.startsWith("/")) {
    return (
      <Link href={demande.href} className={cls}>
        {inner}
      </Link>
    );
  }
  const isExternal = demande.href.startsWith("http");
  return (
    <a
      href={demande.href}
      className={cls}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

export default function SupportPage() {
  return (
    <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
      {/* En-tête */}
      <header className="mb-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Support
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Besoin d’aide ?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-neutral-300">
          Une question, un souci ou une proposition ? Le staff XBZ est là pour t’aider.
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-xbz-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-semibold text-xbz-cyan">
          <span aria-hidden="true">⏱️</span> Réponse généralement sous 48h
        </p>
      </header>

      {/* Canaux de contact */}
      <section aria-labelledby="canaux-heading" className="mb-16">
        <h2
          id="canaux-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          NOUS CONTACTER
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="card-xbz flex flex-col p-6 text-center">
            <span aria-hidden="true" className="text-3xl">
              💬
            </span>
            <h3 className="mt-3 font-display text-lg text-white">Discord</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
              Le canal le plus rapide pour joindre la communauté et le staff.
            </p>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 rounded-xl bg-[#5865F2] px-6 py-3 font-bold text-white transition hover:brightness-110 motion-safe:hover:-translate-y-0.5"
            >
              Rejoindre le Discord
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          </div>

          <div className="card-xbz flex flex-col p-6 text-center">
            <span aria-hidden="true" className="text-3xl">
              ✉️
            </span>
            <h3 className="mt-3 font-display text-lg text-white">Email</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-400">
              Pour les demandes officielles, professionnelles ou de partenariat.
            </p>
            <a
              href={`mailto:${MAIL}`}
              className="mt-4 rounded-xl border border-white/25 px-6 py-3 font-bold text-white transition hover:border-white/60 hover:bg-white/5 motion-safe:hover:-translate-y-0.5"
            >
              Envoyer un email
            </a>
          </div>
        </div>
      </section>

      {/* Aiguillage par type de demande */}
      <section aria-labelledby="demandes-heading" className="mb-16">
        <h2
          id="demandes-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          QUEL EST TON BESOIN ?
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {demandes.map((demande) => (
            <li key={demande.title}>
              <DemandeCard demande={demande} />
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="mb-16">
        <h2
          id="faq-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          QUESTIONS FRÉQUENTES
        </h2>
        <div className="flex flex-col gap-3">
          {faq.map((item) => (
            <details key={item.q} className="card-xbz group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-xbz-cyan transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Formulaire de contact */}
      <section aria-labelledby="form-heading" className="mb-16">
        <h2
          id="form-heading"
          className="mb-6 text-center font-display text-xl font-bold tracking-[2px] text-neutral-300"
        >
          ÉCRIS-NOUS
        </h2>
        <div className="card-xbz p-6 sm:p-8">
          <SupportForm />
        </div>
      </section>

      {/* Charte de contact */}
      <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-neutral-400">
        ⚠️ Les messages abusifs, le spam ou les trolls pourront entraîner des sanctions sur la
        plateforme ou le serveur Discord. Merci de rester respectueux avec le staff.
      </p>
    </div>
  );
}
