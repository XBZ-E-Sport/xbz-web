"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DISCORD_SCOPES } from "@/lib/discord-guard";
import { siteConfig } from "@/lib/site";

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Identifiants invalides.")}`);
  }
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function loginWithDiscord() {
  const supabase = await createClient();
  // L'en-tête `Origin` est normalement présent (soumission de formulaire), mais
  // un `!` produirait l'URL "null/auth/callback" s'il manquait — et Discord
  // rejetterait la redirection. On retombe sur le domaine configuré.
  const origin = (await headers()).get("origin") ?? siteConfig.url;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${origin}/auth/callback?next=/admin`,
      // `guilds.members.read` : indispensable pour lire les rôles de la personne
      // sur le serveur XBZ au retour de l'OAuth (voir @/lib/discord-guard).
      scopes: DISCORD_SCOPES,
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Connexion Discord impossible.")}`);
  }
  redirect(data.url); // redirige vers Discord
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}