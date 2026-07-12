import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";

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
      {children}
    </div>
  );
}