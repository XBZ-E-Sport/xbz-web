// Rate limiting simple, adossé à Supabase (pas de service externe).
// On compte les requêtes récentes par IP + route sur une fenêtre glissante ;
// au-delà du seuil, l'appelant renvoie 429. Écrit/lu via service_role.

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** IP client (Vercel renseigne `x-forwarded-for`). */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

type Options = { limit?: number; windowSeconds?: number };

/**
 * Autorise au plus `limit` requêtes par (IP, route) sur `windowSeconds`.
 * En cas d'erreur de lecture, on laisse passer (on ne bloque jamais un
 * utilisateur légitime à cause d'un souci d'infra).
 */
export async function checkRateLimit(
  ip: string,
  route: string,
  { limit = 5, windowSeconds = 60 }: Options = {},
): Promise<{ allowed: boolean; retryAfter: number }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("route", route)
    .gte("created_at", since);

  if (error) {
    console.error("[ratelimit] count:", error.message);
    return { allowed: true, retryAfter: 0 };
  }

  if ((count ?? 0) >= limit) {
    return { allowed: false, retryAfter: windowSeconds };
  }

  // Enregistre ce hit, puis purge best-effort les vieux hits (table légère).
  await admin.from("rate_limit_hits").insert({ ip, route });
  await admin.from("rate_limit_hits").delete().lt("created_at", since);

  return { allowed: true, retryAfter: 0 };
}
