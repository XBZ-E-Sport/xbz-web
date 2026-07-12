"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUTS = ["en_attente", "accepte", "refuse", "entretien"] as const;
type Statut = (typeof STATUTS)[number];

// Re-vérifie l'autorisation DANS l'action (une server action est un endpoint
// POST joignable directement : on ne se repose pas que sur le layout).
async function assertStaff() {
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

export async function updateStatut(formData: FormData) {
  const id = String(formData.get("id"));
  const statut = String(formData.get("statut"));

  if (!id || !STATUTS.includes(statut as Statut)) {
    throw new Error("Requête invalide.");
  }

  const admin = await assertStaff();

  const { error } = await admin.from("candidatures").update({ statut }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}