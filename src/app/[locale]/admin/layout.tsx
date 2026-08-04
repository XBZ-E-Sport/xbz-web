import { Link } from "@/i18n/navigation";
import { Toaster } from "sonner";
import { requireStaff } from "@/lib/adminguard";
import { signOut } from "@/app/[locale]/login/actions";

// Back-office : auth + données live → jamais prérendu au build (tout le sous-arbre /admin).
export const dynamic = "force-dynamic";

/**
 * `noindex` pour TOUT le back-office, posé au layout pour qu'aucune page
 * ajoutée plus tard ne puisse l'oublier.
 *
 * `robots.txt` interdit déjà l'exploration, mais un `Disallow` n'empêche pas
 * une URL d'apparaître dans les résultats si elle est découverte autrement (un
 * lien collé quelque part suffit) : Google la liste alors sans en connaître le
 * contenu. Cette balise-ci, elle, interdit vraiment l'indexation.
 *
 * ⚠️ Ne JAMAIS lire la base ici ni dans un `generateMetadata` d'une page admin.
 * Les métadonnées sont calculées AVANT que `requireStaff()` ne s'exécute : ce
 * qui y transite part dans le HTML servi aux visiteurs non connectés. Vérifié
 * en prod : `/fr/admin` renvoie 200 avec le titre du back-office à un anonyme
 * (le corps, lui, est bien la page de connexion).
 */
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Rôle Discord vérifié à la connexion OU allowlist email — même garde que les
  // server actions (@/lib/adminguard), pour qu'il n'existe qu'une seule règle.
  const { user } = await requireStaff();

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-28">
      {/* Retours d'action du back-office (enregistrement, suppression, erreurs). */}
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <h1 className="font-display text-2xl font-bold">Back-office XBZ</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span className="hidden sm:inline">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 transition hover:border-red-400 hover:text-white hover:cursor-pointer">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <nav aria-label="Sections du back-office" className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/admin"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
        >
          📋 Candidatures
        </Link>
        <Link
          href="/admin/rosters"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
        >
          🎮 Rosters &amp; Joueurs
        </Link>
        <Link
          href="/admin/poles"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
        >
          🧩 Pôles &amp; Staff
        </Link>
        <Link
          href="/admin/articles"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
        >
          📰 Actualité
        </Link>
        <Link
          href="/admin/boutique"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
        >
          🛒 Boutique
        </Link>
      </nav>

      {children}
    </div>
  );
}