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

const DISCORD_API = "https://discord.com/api/v10";

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
