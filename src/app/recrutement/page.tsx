import Link from "next/link";

import RecrutementForm from "@/components/RecrutementForm";
import { getOpenRolesByCategory } from "@/lib/equipes";

export const metadata = {
  title: "Recrutement — XBZ Esport",
  description:
    "Rejoins XBZ Esport : postes joueurs, staff et création ouverts. Candidate en ligne en quelques minutes.",
};

// Rôles ouverts lus en base à chaque visite.
export const dynamic = "force-dynamic";

export default async function RecrutementPage() {
  const rolesByCategory = await getOpenRolesByCategory();
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-6 pb-24 pt-32">
      {/* En-tête */}
      <header className="mb-8 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-xbz-cyan">
          Recrutement
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_30px_rgba(0,102,255,0.4)] sm:text-5xl">
          Rejoins XBZ
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-neutral-300">
          Envie de porter les couleurs XBZ ? Remplis le formulaire ci-dessous — chaque
          candidature est étudiée par le staff.
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-xbz-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-semibold text-xbz-cyan">
          <span aria-hidden="true">🔞</span> 16 ans minimum
        </p>
      </header>

      <p className="mb-8 text-center text-sm text-neutral-400">
        Curieux des postes disponibles ?{" "}
        <Link href="/equipes" className="font-semibold text-xbz-cyan hover:underline">
          Découvre les postes ouverts
        </Link>{" "}
        sur la page Équipes.
      </p>

      {/* Formulaire */}
      <div className="card-xbz p-6 sm:p-8">
        <RecrutementForm rolesByCategory={rolesByCategory} />
      </div>
    </div>
  );
}
