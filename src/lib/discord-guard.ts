import "server-only";

// Contrôle d'accès Discord à la connexion du back-office.
//
// Règle : seul un membre du serveur XBZ portant l'un des rôles autorisés
// (Administrateur, Fondateur) peut se connecter via Discord.
//
// Méthode : on interroge l'API Discord AVEC LE JETON DE L'UTILISATEUR obtenu
// pendant l'OAuth (scope `guilds.members.read`). Aucune dépendance au bot :
// la connexion continue de fonctionner même si le bot Render est éteint, et
// aucun intent privilégié n'est nécessaire.
//
// Configuration (voir .env.example) :
//   DISCORD_GUILD_ID        id du serveur XBZ
//   DISCORD_STAFF_ROLE_IDS  ids des rôles autorisés, séparés par des virgules
// Non configuré → on REFUSE (fail-safe) : la connexion par mot de passe reste
// disponible, on ne laisse jamais la porte ouverte par simple oubli.

import { createAdminClient } from "@/lib/supabase/admin";

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Durée de validité du verdict Discord enregistré à la connexion.
 * Passé ce délai, le back-office redemande une connexion → le rôle est
 * revérifié auprès de Discord. C'est ce qui rend une révocation effective
 * sans avoir à interroger Discord à chaque page.
 *
 * 1 jour, et pas 7 : cette durée est exactement le sursis dont dispose une
 * personne à qui on vient de retirer son rôle. Une semaine, c'est long quand
 * un départ se passe mal. Le coût du raccourcissement est une reconnexion
 * quotidienne pour le staff — un clic sur « Se connecter avec Discord ».
 */
export const STAFF_TTL_DAYS = 1;

/** Scopes OAuth demandés à Discord. `guilds.members.read` autorise la lecture
 *  des rôles de l'utilisateur DANS CE SERVEUR uniquement (rien d'autre). */
export const DISCORD_SCOPES = "identify email guilds.members.read";

export type DiscordDenyReason =
  | "not_configured" // variables d'env absentes
  | "no_token" // pas de provider_token dans la session
  | "not_member" // pas sur le serveur XBZ
  | "missing_role" // sur le serveur, mais sans rôle autorisé
  | "error"; // Discord injoignable / réponse inattendue

export type DiscordCheck = { ok: true; roles: string[] } | { ok: false; reason: DiscordDenyReason };

/** Ids des rôles autorisés à se connecter. */
export function staffRoleIds(): string[] {
  return (process.env.DISCORD_STAFF_ROLE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Message affiché à l'utilisateur refusé (jamais de détail technique). */
export function denyMessage(reason: DiscordDenyReason): string {
  switch (reason) {
    case "not_member":
      return "Tu dois être membre du serveur Discord XBZ pour te connecter.";
    case "missing_role":
      return "Ton compte Discord n’a pas le rôle requis (Administrateur ou Fondateur).";
    case "not_configured":
      return "La connexion Discord n’est pas configurée. Contacte un administrateur.";
    default:
      return "Vérification Discord impossible pour le moment. Réessaie dans un instant.";
  }
}

/**
 * Vérifie l'appartenance au serveur ET la présence d'un rôle autorisé.
 * `providerToken` = `session.provider_token` renvoyé par l'échange OAuth.
 */
export async function checkDiscordStaff(
  providerToken: string | null | undefined,
): Promise<DiscordCheck> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const allowedRoles = staffRoleIds();

  if (!guildId || allowedRoles.length === 0) return { ok: false, reason: "not_configured" };
  if (!providerToken) return { ok: false, reason: "no_token" };

  let response: Response;
  try {
    response = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, reason: "error" };
  }

  // 404 = l'utilisateur n'est pas membre de ce serveur.
  if (response.status === 404) return { ok: false, reason: "not_member" };
  if (!response.ok) return { ok: false, reason: "error" };

  let member: { roles?: unknown };
  try {
    member = await response.json();
  } catch {
    return { ok: false, reason: "error" };
  }

  const roles = Array.isArray(member.roles) ? member.roles.map(String) : [];
  if (!roles.some((role) => allowedRoles.includes(role))) {
    return { ok: false, reason: "missing_role" };
  }

  return { ok: true, roles };
}

// =============================================================================
//  Mémorisation du verdict
//
//  Le jeton OAuth n'existe qu'au moment du callback : on ne peut pas réinterroger
//  Discord à chaque page. Le verdict est donc écrit dans `app_metadata` de
//  l'utilisateur Supabase — champ que SEULE la clé service_role peut modifier
//  (l'utilisateur ne peut pas se l'attribuer lui-même, contrairement à
//  `user_metadata`).
// =============================================================================

type AppMetadata = Record<string, unknown> | undefined | null;

/** Enregistre « staff Discord vérifié » sur le compte. */
export async function markDiscordStaff(userId: string, roles: string[]): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      xbz_staff: true,
      xbz_staff_at: new Date().toISOString(),
      xbz_roles: roles,
    },
  });
  if (error) console.error("[auth] écriture du verdict Discord échouée:", error.message);
}

/** Retire l'accès staff (rôle perdu, exclusion du serveur…). */
export async function clearDiscordStaff(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { xbz_staff: false, xbz_staff_at: null, xbz_roles: [] },
  });
  if (error) console.error("[auth] révocation du verdict Discord échouée:", error.message);
}

/** Vrai si le compte porte un verdict Discord valide ET encore frais. */
export function hasFreshDiscordStaff(appMetadata: AppMetadata): boolean {
  if (!appMetadata || appMetadata.xbz_staff !== true) return false;

  const verifiedAt = Date.parse(String(appMetadata.xbz_staff_at ?? ""));
  if (Number.isNaN(verifiedAt)) return false;

  return Date.now() - verifiedAt < STAFF_TTL_DAYS * 24 * 3600 * 1000;
}
