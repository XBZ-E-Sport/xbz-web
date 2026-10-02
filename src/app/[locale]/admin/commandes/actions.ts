"use server";

import { assertStaff } from "@/lib/adminguard";
import { adminAction, dbError } from "@/lib/admin-action";
import { AdminError, type AdminResult } from "@/lib/admin-result";
import { revalidateLocalizedPath } from "@/lib/cache";

/**
 * Marque une commande payée comme expédiée.
 *
 * Seul changement possible à la main : « payée » vient du webhook Stripe,
 * « remboursée » d'un remboursement fait dans Stripe — jamais d'un clic ici,
 * pour que le back-office ne puisse pas dire autre chose que Stripe.
 * Server action = endpoint joignable directement : la garde vit ICI.
 */
export async function markOrderShipped(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = String(formData.get("id") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AdminError("Identifiant de commande invalide.");

    const { data, error } = await admin
      .from("orders")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "paid")
      .select("id");
    if (error) throw dbError(error);
    if (!data?.length) throw new AdminError("Cette commande n'est plus « payée » (déjà expédiée ou remboursée).");

    revalidateLocalizedPath("/admin/commandes");
  });
}
