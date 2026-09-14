"use server";

import { requireStaff } from "@/lib/adminguard";
import { revalidateLocalizedPath } from "@/lib/cache";

// Statuts qu'un membre du staff peut poser à la main depuis le back-office.
// 'paid' est posé par le webhook Stripe, jamais ici.
const MANUAL_STATUTS = ["fulfilled", "refunded"] as const;
type ManualStatut = (typeof MANUAL_STATUTS)[number];

/**
 * Change le statut d'une commande (expédiée / remboursée).
 *
 * Server action = endpoint POST joignable directement : la garde vit ICI, pas
 * seulement dans le layout. On ne touche jamais au montant ni aux données
 * client — seulement l'avancement de la commande.
 */
export async function setOrderStatus(formData: FormData) {
  const { admin } = await requireStaff();

  const id = String(formData.get("id") ?? "").trim();
  const statut = String(formData.get("statut") ?? "");
  if (!id) throw new Error("Identifiant de commande manquant.");
  if (!(MANUAL_STATUTS as readonly string[]).includes(statut)) {
    throw new Error("Statut invalide.");
  }

  const { error } = await admin
    .from("orders")
    .update({ status: statut as ManualStatut })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateLocalizedPath("/admin/commandes");
}
