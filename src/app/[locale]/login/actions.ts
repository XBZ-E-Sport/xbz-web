"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DISCORD_SCOPES } from "@/lib/discord-guard";
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
  revalidatePath("/", "layout");
  redirect(localizedPath("/admin", locale));
}

export async function loginWithDiscord() {
  const locale = await getLocale();
  const supabase = await createClient();
  // L'en-tête `Origin` est normalement présent (soumission de formulaire), mais
  // un `!` produirait l'URL "null/auth/callback" s'il manquait — et Discord
  // rejetterait la redirection. On retombe sur le domaine configuré.
  const origin = (await headers()).get("origin") ?? siteConfig.url;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      // `next` porte la langue : au retour de Discord, la route de callback est
      // hors du segment `[locale]` et n'a aucun autre moyen de la connaître.
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(localizedPath("/admin", locale))}`,
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
  revalidatePath("/", "layout");
  redirect(localizedPath("/login", locale));
}