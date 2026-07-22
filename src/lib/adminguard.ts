import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vérifie que l'appelant est connecté ET membre du staff (allowlist).
 * À appeler DANS chaque server action (endpoint POST joignable directement :
 * on ne se repose jamais uniquement sur le layout). Retourne le client admin.
 */
export async function assertStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("allow_staff_list")
    .select("email")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (!staff) redirect("/login");
  return admin;
}
