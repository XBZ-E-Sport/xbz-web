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

/** Huit groupes hexadécimaux d'une IPv6 (compressée, IPv4 finale, zone…), sinon `null`. */
function ipv6Groups(s: string): number[] | null {
  let body = s;
  const tail: number[] = [];
  const v4 = body.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const octets = v4[2].split(".").map(Number);
    if (octets.some((o) => o > 255)) return null;
    tail.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
    body = v4[1].endsWith("::") ? v4[1] : v4[1].slice(0, -1);
  }
  const halves = body.split("::");
  if (halves.length > 2) return null;
  const part = (h: string) => (h ? h.split(":") : []);
  const head = part(halves[0]);
  const rest = halves.length === 2 ? part(halves[1]) : [];
  const fill = 8 - tail.length - head.length - rest.length;
  if (halves.length === 1 ? fill !== 0 : fill < 0) return null;
  const hex = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill("0"), ...rest];
  if (!hex.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return [...hex.map((g) => parseInt(g, 16)), ...tail];
}

/**
 * Clé de comptage d'une IP.
 *
 * IPv4 : l'adresse (zéros de tête et port retirés). IPv6 : le préfixe /64 —
 * UN abonné (une box, un serveur) : un FAI ou un hébergeur en attribue au
 * moins un /64 entier par client, soit 2^64 adresses ; compter l'adresse
 * complète offrait une identité neuve à chaque envoi. `prefix: 48` sert au
 * second seuil des formulaires (voir `checkFormRateLimit`). Une IPv4
 * encapsulée (`::ffff:1.2.3.4`, `::ffff:102:304`) est ramenée à l'IPv4. Une
 * valeur illisible (« unknown »…) est gardée telle quelle.
 */
export function rateLimitKey(ip: string, prefix: 64 | 48 = 64): string {
  const raw = ip.trim();
  let s = raw.toLowerCase();
  const bracketed = s.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) s = bracketed[1];
  s = s.split("%")[0];

  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::\d+)?$/);
  if (v4) {
    const octets = v4.slice(1, 5).map(Number);
    return octets.every((o) => o <= 255) ? octets.join(".") : raw;
  }
  if (!s.includes(":")) return raw;

  const g = ipv6Groups(s);
  if (!g) return raw;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".");
  }
  return `${g
    .slice(0, prefix / 16)
    .map((x) => x.toString(16))
    .join(":")}::/${prefix}`;
}

type Options = {
  limit?: number;
  windowSeconds?: number;
  /** Préfixe IPv6 compté (64 = un abonné, 48 = un bloc : voir `rateLimitKey`). */
  prefix?: 64 | 48;
  /**
   * Que faire si le compteur lui-même est en panne (Supabase injoignable) ?
   *
   * Par défaut on REFUSE. Le raisonnement : sur les formulaires publics,
   * l'étape suivante est justement une écriture dans cette même base — si la
   * lecture échoue, l'enregistrement échouera aussi. Laisser passer n'aide donc
   * personne, et ouvre grand la porte au spam pile au moment le plus fragile.
   *
   * `true` sert aux appels dont la suite NE dépend PAS de Supabase : la
   * remontée d'erreurs client part vers un webhook Discord et doit continuer à
   * fonctionner pendant une panne — c'est même là qu'elle est la plus utile.
   */
  failOpen?: boolean;
};

/**
 * Autorise au plus `limit` requêtes par (IP, route) sur `windowSeconds`.
 *
 * Ordre : on ENREGISTRE d'abord ce passage, puis on compte en l'incluant.
 * L'ordre inverse (compter, puis enregistrer) laissait une rafale parallèle
 * passer en entier : toutes les requêtes comptaient avant qu'aucune n'ait
 * écrit. Ici, une requête acceptée a toujours écrit avant de compter, donc la
 * dernière acceptée voit toutes les autres : jamais plus de `limit` acceptées.
 *
 * Compromis assumé : des requêtes SIMULTANÉES d'une même IP se voient toutes
 * et peuvent être toutes refusées (conservateur). Les passages refusés sont
 * retirés aussitôt, donc l'envoi suivant, lui, passe. Pour un formulaire
 * rempli à la main, la simultanéité n'arrive pas.
 */
export async function checkRateLimit(
  ip: string,
  route: string,
  { limit = 5, windowSeconds = 60, failOpen = false, prefix = 64 }: Options = {},
): Promise<{ allowed: boolean; retryAfter: number }> {
  const admin = createAdminClient();
  const key = rateLimitKey(ip, prefix);
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const broken = () => ({ allowed: failOpen, retryAfter: failOpen ? 0 : windowSeconds });

  const { data: hit, error: insertError } = await admin
    .from("rate_limit_hits")
    .insert({ ip: key, route })
    .select("id")
    .single();
  if (insertError || !hit) {
    console.error("[ratelimit] insert:", insertError?.message ?? "aucune ligne");
    return broken();
  }

  const { count, error } = await admin
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("ip", key)
    .eq("route", route)
    .gte("created_at", since);
  if (error) {
    console.error("[ratelimit] count:", error.message);
    return broken();
  }

  if ((count ?? 0) > limit) {
    // Passage refusé : on le retire, pour qu'une rafale refusée ne prolonge pas
    // le blocage (seuls les passages acceptés comptent, comme avant).
    await admin.from("rate_limit_hits").delete().eq("id", hit.id);
    return { allowed: false, retryAfter: windowSeconds };
  }

  // Purge best-effort des vieux passages (table légère).
  await admin.from("rate_limit_hits").delete().lt("created_at", since);
  return { allowed: true, retryAfter: 0 };
}

/**
 * Anti-flood des formulaires publics (recrutement, support) : 5 envois/min
 * par abonné (IPv4, ou /64 en IPv6) ET, en IPv6, 15/min par /48 — un tunnel
 * IPv6 gratuit fournit un /48 entier, soit 65 536 /64 : autant d'identités
 * avec le seul premier seuil. 15 laisse de la marge aux abonnés d'un même
 * fournisseur qui partageraient un /48.
 */
export async function checkFormRateLimit(
  ip: string,
  route: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const perSubscriber = await checkRateLimit(ip, route);
  if (!perSubscriber.allowed || !rateLimitKey(ip).endsWith("::/64")) return perSubscriber;
  return checkRateLimit(ip, `${route}:net`, { limit: 15, prefix: 48 });
}
