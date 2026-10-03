import { requireStaff } from "@/lib/adminguard";
import {
  EXPORT_STATUSES,
  MAX_EXPORT_ROWS,
  exportFilename,
  exportHeaders,
  exportRows,
  parseExportParams,
  toCsv,
} from "@/lib/orders-export";
import type { Order } from "@/lib/shop";

// Export CSV des commandes payées, pour la comptabilité (contenu et format :
// src/lib/orders-export.ts). Réservé au staff, comme tout le back-office.
//
// Une route et non une server action : un téléchargement est une navigation
// GET (le navigateur enregistre le fichier sans quitter la page). La garde
// vit ICI, avant toute lecture — le layout du back-office ne protège pas une
// route. Voir guard.test.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Taille d'une page de lecture : PostgREST plafonne une réponse à 1 000 lignes. */
const PAGE = 1000;

const plain = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function GET(request: Request): Promise<Response> {
  const { user, admin } = await requireStaff();

  const parsed = parseExportParams(new URL(request.url).searchParams);
  if (!parsed.ok) return plain(400, parsed.error);
  const params = parsed.params;

  // Classées par date de PAIEMENT : c'est elle qui fait entrer la vente dans
  // une période. Un remboursement ultérieur figure sur la ligne de la commande
  // (date et montant), pas dans la période où il a eu lieu.
  const orders: Order[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .from("orders")
      .select("*")
      .in("status", [...EXPORT_STATUSES])
      .gte("paid_at", params.from.toISOString())
      .lt("paid_at", params.to.toISOString())
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("[export commandes]", error.message);
      return plain(500, "Lecture des commandes impossible. Réessaie, ou consulte les journaux du serveur.");
    }
    orders.push(...((data ?? []) as Order[]));
    if (orders.length > MAX_EXPORT_ROWS) {
      return plain(413, `Plus de ${MAX_EXPORT_ROWS} commandes sur cette période : réduis les dates.`);
    }
    if ((data?.length ?? 0) < PAGE) break;
  }

  // Trace d'accès : un fichier de clients (avec `perso=1`) a quitté le site.
  console.info(
    "[export commandes]",
    JSON.stringify({
      staff: user.email ?? user.id,
      du: params.fromDay,
      au: params.toDay,
      detail: params.detail,
      perso: params.personal,
      commandes: orders.length,
    }),
  );

  return new Response(toCsv(exportHeaders(params), exportRows(orders, params)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(params)}"`,
      // Données privées : jamais en cache (navigateur, CDN, proxy).
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
