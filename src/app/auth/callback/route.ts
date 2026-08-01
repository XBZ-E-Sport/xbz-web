import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkDiscordStaff, denyMessage } from "@/lib/discord-guard";

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

  if (!check.ok) {
    // Refus → on révoque la session immédiatement (sinon un compte non
    // autorisé resterait connecté, même sans accès au back-office).
    await supabase.auth.signOut();
    console.warn(
      "[auth] connexion Discord refusée:",
      check.reason,
      data.session.user.email ?? data.session.user.id,
    );
    return denied(origin, denyMessage(check.reason));
  }

  return NextResponse.redirect(`${origin}${next}`);
}
