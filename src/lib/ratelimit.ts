// Rate limiting simple, adossé à Supabase (pas de service externe).
// On compte les requêtes récentes par IP + route sur une fenêtre glissante ;
// au-delà du seuil, l'appelant renvoie 429. Écrit/lu via service_role.

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * IP du client, choisie pour ne PAS être dictée par le client lui-même.
 *
 * `x-forwarded-for` est une liste, et n'importe qui peut l'amorcer avec la
 * valeur de son choix. La convention veut que chaque relais AJOUTE à la fin
 * l'adresse qu'il a réellement vue : la DERNIÈRE entrée est donc celle posée
 * par le relais le plus proche de nous — la seule qu'une requête entrante ne
 * puisse pas choisir. Prendre la première laisserait quiconque changer
 * d'identité à chaque envoi, et l'anti-flood ne compterait plus rien.
 *
 * Mesuré sur la prod (Vercel écrase l'en-tête entrante) : la version « première
 * entrée » n'était en fait pas contournable. Mais elle reposait entièrement sur
 * ce comportement de plateforme, non garanti par contrat et faux dès qu'un
 * autre relais s'intercale — Cloudflare devant Vercel, ou un déménagement
 * d'hébergeur. On ne veut pas que l'anti-flood dépende de ça.
 *
 * ⚠️ Si un jour un CDN tiers passe DEVANT Vercel, la dernière entrée devient
 * l'adresse de ce CDN et toutes les visites partageraient le même compteur.
 * Il faudra alors lire l'en-tête propre à ce CDN (`cf-connecting-ip` & co).
 */
export function getClientIp(request: Request): string {
  // Posée par Vercel, jamais transmise depuis l'extérieur.
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",");
    return hops[hops.length - 1]?.trim() || "unknown";
  }

  return "unknown";
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
