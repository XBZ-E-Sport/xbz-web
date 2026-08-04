"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DISCORD_SCOPES } from "@/lib/discord-guard";
import { LOCALE_COOKIE } from "@/i18n/routing";
import { siteConfig, localizedPath } from "@/lib/site";

// Toutes les URL portent leur langue : on redirige vers `/fr/admin` (ou
// `/en/admin`) plutôt que `/admin`, qui ferait un rebond par le proxy et
// ramènerait la personne en français.
export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const locale = await getLocale();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const login = localizedPath("/login", locale);
    redirect(`${login}?error=${encodeURIComponent("Identifiants invalides.")}`);
  }
  // Pas de `revalidatePath` ici : la coquille publique (layout, en-tête, pied
  // de page) ne lit aucune session, et tout le sous-arbre `/admin` est en
  // `force-dynamic` — il n'existe donc aucun HTML en cache que la connexion
  // rendrait périmé. L'ancien `revalidatePath("/", "layout")` ne visait de
  // toute façon plus aucune route depuis le passage sous `[locale]`.
  redirect(localizedPath("/admin", locale));
}

export async function loginWithDiscord() {
  const locale = await getLocale();
  const supabase = await createClient();
  // L'en-tête `Origin` est normalement présent (soumission de formulaire), mais
  // un `!` produirait l'URL "null/auth/callback" s'il manquait — et Discord
  // rejetterait la redirection. On retombe sur le domaine configuré.
  const origin = (await headers()).get("origin") ?? siteConfig.url;

  // On grave la langue AVANT de partir chez Discord : c'est le seul bagage que
  // la personne emportera. next-intl ne pose ce cookie que s'il détecte un
  // écart (langue changée au sélecteur, ou `accept-language` divergent) — un
  // anglophone arrivé droit sur /en/login n'en a donc aucun, et le callback
  // n'aurait rien à lire.
  const { name: cookieName, ...cookieOptions } = LOCALE_COOKIE;
  (await cookies()).set(cookieName, locale, cookieOptions);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      // AUCUNE query string ici, volontairement. Supabase compare le
      // `redirectTo` à sa liste d'URL autorisées ; un `?next=…` accolé fait
      // échouer la correspondance avec une entrée exacte, et Supabase renvoie
      // alors sur le Site URL — le code OAuth atterrit sur l'accueil au lieu du
      // callback, sans le moindre message d'erreur.
      // La langue voyage par le cookie `XBZ_LOCALE`, que le callback relit.
      redirectTo: `${origin}/auth/callback`,
      // `guilds.members.read` : indispensable pour lire les rôles de la personne
      // sur le serveur XBZ au retour de l'OAuth (voir @/lib/discord-guard).
      scopes: DISCORD_SCOPES,
    },
  });

  if (error || !data.url) {
    const login = localizedPath("/login", locale);
    redirect(`${login}?error=${encodeURIComponent("Connexion Discord impossible.")}`);
  }
  redirect(data.url); // redirige vers Discord
}

export async function signOut() {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Même raison qu'à la connexion : rien de public ne dépend de la session.
  redirect(localizedPath("/login", locale));
}