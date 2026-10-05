import { printText } from "@/lib/personalization";
import type { OrderItem } from "@/lib/shop";

/**
 * Encadré affiché quand une rétractation touche une commande qui contient un article
 * PERSONNALISÉ : exclu du droit de rétractation (article L.221-28, 3° du Code de la
 * consommation), les autres articles restent remboursables. Rien n'est jamais
 * remboursé automatiquement : c'est au staff de trancher, article par article.
 */
export function printedItems(items: readonly OrderItem[] | null | undefined): OrderItem[] {
  return (Array.isArray(items) ? items : []).filter((i) => i.print);
}

export default function PersonalizedNotice({ items }: { items: readonly OrderItem[] | null | undefined }) {
  const printed = printedItems(items);
  if (printed.length === 0) return null;
  const list = printed
    .map((i) => `${i.quantity} × ${i.name}${i.size ? ` (${i.size})` : ""} — ${printText(i.print!, "n°")}`)
    .join(" ; ");
  return (
    <p className="mt-2 rounded-lg border border-xbz-cyan/40 bg-xbz-cyan/10 px-3 py-2 text-sm text-xbz-cyan">
      ✏️ Cette commande contient {printed.length === 1 ? "un article personnalisé" : `${printed.length} lignes personnalisées`}{" "}
      ({list}) : pas de droit de rétractation sur {printed.length === 1 ? "cet article" : "ces articles"} (article L.221-28,
      3° du Code de la consommation). Les autres articles restent remboursables si le client les renvoie ; les garanties
      légales restent dues. Réponds au client par e-mail en disant ce qui est accepté et ce qui est refusé, puis rembourse
      dans Stripe le seul montant des articles concernés (remboursement partiel).
    </p>
  );
}
