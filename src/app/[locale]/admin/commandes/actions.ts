"use server";

import { assertStaff } from "@/lib/adminguard";
import { adminAction, dbError } from "@/lib/admin-action";
import { AdminError, type AdminResult } from "@/lib/admin-result";
import { revalidateLocalizedPath } from "@/lib/cache";
import { orderNumber } from "@/lib/shop";
import { normalizeOrderNumber } from "@/lib/withdrawal";
import { sendAck } from "@/lib/withdrawal-server";

const UUID = /^[0-9a-f-]{36}$/i;

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

/**
 * Renvoie l'accusé de réception d'une rétractation (échec du fournisseur d'e-mails,
 * plafond d'envois atteint…). `force` : le staff décide, on ignore le nombre d'essais.
 */
export async function resendWithdrawalAck(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = String(formData.get("id") ?? "").trim();
    if (!UUID.test(id)) throw new AdminError("Identifiant de déclaration invalide.");

    const result = await sendAck(admin, id, { force: true });
    if (!result.sent) throw new AdminError(`Accusé non envoyé : ${result.error ?? "raison inconnue"}.`);
    revalidateLocalizedPath("/admin/commandes");
  });
}

/** Marque une rétractation comme traitée (retour reçu, remboursement fait) — ou la rouvre. */
export async function setWithdrawalProcessed(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = String(formData.get("id") ?? "").trim();
    if (!UUID.test(id)) throw new AdminError("Identifiant de déclaration invalide.");
    const done = String(formData.get("done") ?? "") === "1";

    const { data, error } = await admin
      .from("order_withdrawals")
      .update({ processed_at: done ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id");
    if (error) throw dbError(error);
    if (!data?.length) throw new AdminError("Cette déclaration n'existe plus.");
    revalidateLocalizedPath("/admin/commandes");
  });
}

/**
 * Rattache à la main une rétractation à sa commande (rapprochement automatique
 * impossible : plusieurs commandes pour l'e-mail, ou aucune). Le staff saisit le
 * numéro de commande (`XBZ-1A2B3C4D`) qu'il lit dans la liste des commandes.
 */
export async function linkWithdrawalToOrder(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = String(formData.get("id") ?? "").trim();
    if (!UUID.test(id)) throw new AdminError("Identifiant de déclaration invalide.");
    const number = normalizeOrderNumber(String(formData.get("numero") ?? ""));
    if (!number) throw new AdminError("Numéro de commande invalide (attendu : XBZ- suivi de 8 caractères).");

    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("id")
      .in("status", ["paid", "fulfilled", "refunded"])
      .order("created_at", { ascending: false })
      .limit(1000);
    if (ordersError) throw dbError(ordersError);
    const order = ((orders ?? []) as { id: string }[]).find((o) => orderNumber(o.id) === number);
    if (!order) throw new AdminError(`Aucune commande payée ne porte le numéro ${number}.`);

    const { data, error } = await admin
      .from("order_withdrawals")
      // `order_number` reste TEL QUE le client l'a tapé (contenu de sa déclaration).
      .update({ order_id: order.id, match: "exact" })
      .eq("id", id)
      .select("id");
    if (error) throw dbError(error);
    if (!data?.length) throw new AdminError("Cette déclaration n'existe plus.");
    revalidateLocalizedPath("/admin/commandes");
  });
}

/**
 * Supprime une déclaration (essai du staff, spam). Les vraies déclarations sont des
 * preuves : elles se marquent « traitées », elles ne se suppriment pas à la légère
 * (le formulaire demande confirmation).
 */
export async function deleteWithdrawal(formData: FormData): Promise<AdminResult> {
  return adminAction(async () => {
    const admin = await assertStaff();
    const id = String(formData.get("id") ?? "").trim();
    if (!UUID.test(id)) throw new AdminError("Identifiant de déclaration invalide.");
    const { error } = await admin.from("order_withdrawals").delete().eq("id", id);
    if (error) throw dbError(error);
    revalidateLocalizedPath("/admin/commandes");
  });
}
