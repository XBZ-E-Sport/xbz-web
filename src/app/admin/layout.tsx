import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";

// Back-office : auth + données live → jamais prérendu au build (tout le sous-arbre /admin).
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Allowlist staff (via clé secret, indépendante de la RLS)
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("allow_staff_list")
    .select("email")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (!staff) {
    redirect(`/login?error=${encodeURIComponent("Accès réservé au staff XBZ.")}`);
  }

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-28">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <h1 className="font-display text-2xl font-bold">Back-office XBZ</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span className="hidden sm:inline">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 transition hover:border-white/40">
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
      </nav>

      {children}
    </div>
  );
}