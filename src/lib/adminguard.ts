import "server-only";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFreshDiscordStaff } from "@/lib/discord-guard";
import { localizedPath } from "@/lib/site";

type AdminClient = ReturnType<typeof createAdminClient>;
type StaffUser = { id: string; email?: string };

/**
 * Contrôle d'accès UNIQUE du back-office.
 *
 * Deux façons d'être staff — la première suffit :
 *  1. rôle Discord (Administrateur / Fondateur) vérifié à la connexion puis
 *     mémorisé dans `app_metadata` : le fondateur donne le rôle, l'accès suit,
 *     sans intervention manuelle ;
 *  2. email présent dans `allow_staff_list` : filet pour les comptes
 *     mot de passe et les accès historiques.
 *
 * À appeler DANS chaque server action : une server action est un endpoint POST
 * joignable directement, on ne se repose jamais uniquement sur le layout.
 */
export async function requireStaff(): Promise<{ user: StaffUser; admin: AdminClient }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Toutes les URL portent leur langue (`/fr/login`) : on renvoie directement à
  // la bonne, sinon le proxy ferait un aller-retour de plus et la personne
  // basculerait en français au passage.
  const loginPath = localizedPath("/login", await getLocale());

  if (!user) redirect(loginPath);

  const admin = createAdminClient();

  // 1) Rôle Discord vérifié récemment (fraîcheur : STAFF_TTL_DAYS).
  if (hasFreshDiscordStaff(user.app_metadata)) {
    return { user: { id: user.id, email: user.email }, admin };
  }

  // 2) Repli : allowlist email, indépendante de la RLS (clé service_role).
  const { data: staff } = await admin
    .from("allow_staff_list")
    .select("email")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (staff) return { user: { id: user.id, email: user.email }, admin };

  redirect(`${loginPath}?error=${encodeURIComponent("Accès réservé au staff XBZ.")}`);
}

/** Raccourci historique : renvoie le client admin une fois l'accès validé. */
export async function assertStaff(): Promise<AdminClient> {
  const { admin } = await requireStaff();
  return admin;
}
