import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export const metadata = { title: "Back-office — XBZ" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-32">
      <div className="card-xbz p-8">
        <h1 className="mb-2 font-display text-3xl font-bold">Back-office XBZ</h1>
        <p className="text-neutral-400">
          Connecté : <span className="text-white">{user.email ?? user.user_metadata?.name ?? user.id}</span>
        </p>
        <form action={signOut} className="mt-6">
          <button className="rounded-lg border border-white/15 px-4 py-2 text-sm transition hover:border-white/40">
            Se déconnecter
          </button>
        </form>
      </div>
    </section>
  );
}