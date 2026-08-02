import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkDiscordStaff,
  clearDiscordStaff,
  denyMessage,
  markDiscordStaff,
} from "@/lib/discord-guard";

// Retour de l'OAuth Discord.
//
// C'EST LE POINT DE CONTRÔLE : la session n'est conservée que si la personne
// est bien membre du serveur XBZ avec un rôle autorisé. Sinon on la déconnecte
// immédiatement — aucune session valide ne doit survivre à un refus.

/** Empêche une redirection ouverte : on n'accepte qu'un chemin interne. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw;
}

function denied(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) return denied(origin, "Échec de l'authentification.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) return denied(origin, "Échec de l'authentification.");

  // Contrôle serveur + rôle Discord, avec le jeton fraîchement obtenu.
  const check = await checkDiscordStaff(data.session.provider_token);

  const userId = data.session.user.id;

  if (!check.ok) {
    // Refus → on retire l'accès staff éventuellement acquis, PUIS on révoque la
    // session (sinon un compte non autorisé resterait connecté).
    // `not_configured` / `error` ne sont pas des refus de rôle : on ne retire
    // rien sur une panne, sinon une coupure Discord dégraderait tout le staff.
    if (check.reason === "not_member" || check.reason === "missing_role") {
      await clearDiscordStaff(userId);
    }
    await supabase.auth.signOut();
    console.warn(
      "[auth] connexion Discord refusée:",
      check.reason,
      data.session.user.email ?? userId,
    );
    return denied(origin, denyMessage(check.reason));
  }

  // Verdict mémorisé : donne l'accès au back-office sans liste manuelle.
  await markDiscordStaff(userId, check.roles);

  return NextResponse.redirect(`${origin}${next}`);
}
