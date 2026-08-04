import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";

import { createClient } from "@/lib/supabase/server";
import { routing, LOCALE_COOKIE } from "@/i18n/routing";
import { localizedPath } from "@/lib/site";
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

/**
 * Langue de la personne qui revient de Discord.
 *
 * Cette route vit HORS du segment `[locale]` : elle n'a aucun contexte de
 * langue, et on ne peut RIEN accoler à son URL. Supabase compare le `redirectTo`
 * à sa liste d'URL autorisées ; un `?next=…` en plus fait échouer la
 * correspondance avec une entrée exacte, Supabase renvoie alors sur le Site URL
 * et le code OAuth atterrit sur l'accueil, sans le moindre message d'erreur.
 *
 * La langue voyage donc par le cookie, écrit juste avant le départ vers Discord
 * (cf. `[locale]/login/actions.ts`).
 */
async function localeFromCookie(): Promise<string> {
  const value = (await cookies()).get(LOCALE_COOKIE.name)?.value;
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/** Empêche une redirection ouverte : on n'accepte qu'un chemin interne. */
function safeNext(raw: string | null, locale: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return localizedPath("/admin", locale);
  }
  return raw;
}

/** Langue effective : celle que porte le chemin de retour, sinon le cookie. */
function localeOf(next: string, fallback: string): string {
  const first = next.split("/")[1];
  return hasLocale(routing.locales, first) ? first : fallback;
}

function denied(origin: string, locale: string, message: string) {
  const login = localizedPath("/login", locale);
  return NextResponse.redirect(`${origin}${login}?error=${encodeURIComponent(message)}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieLocale = await localeFromCookie();
  // `next` n'est plus envoyé par notre action de connexion (voir plus haut),
  // mais on continue de l'accepter : un lien profond peut encore en porter un.
  const next = safeNext(searchParams.get("next"), cookieLocale);
  const locale = localeOf(next, cookieLocale);

  if (!code) return denied(origin, locale, "Échec de l'authentification.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) return denied(origin, locale, "Échec de l'authentification.");

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
    return denied(origin, locale, denyMessage(check.reason));
  }

  // Verdict mémorisé : donne l'accès au back-office sans liste manuelle.
  await markDiscordStaff(userId, check.roles);

  return NextResponse.redirect(`${origin}${next}`);
}
