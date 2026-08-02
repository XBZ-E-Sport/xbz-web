"use server";

import { revalidatePath } from "next/cache";

// Garde d'autorisation partagée (@/lib/adminguard) : une seule implémentation
// pour TOUTES les server actions — une copie locale finirait par diverger.
import { assertStaff } from "@/lib/adminguard";

// Aligné sur le bot Discord : ses boutons écrivent accepte/refuse/entretien.
const STATUTS = ["en_attente", "accepte", "refuse", "entretien"] as const;
type Statut = (typeof STATUTS)[number];

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