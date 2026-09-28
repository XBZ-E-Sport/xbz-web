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

  // Verdict Discord positif mais périmé (TTL d'un jour) : ce n'est pas un refus,
  // juste une reconnexion à faire — le message doit le dire.
  const expired = user.app_metadata?.xbz_staff === true;
  const denied = `${loginPath}?error=${encodeURIComponent(
    expired ? "Session staff expirée : reconnecte-toi avec Discord." : "Accès réservé au staff XBZ.",
  )}`;

  // 2) Repli : allowlist email, indépendante de la RLS (clé service_role) —
  // pour une adresse CONFIRMÉE uniquement. Sans ça, ouvrir un compte à
  // l'adresse d'un membre listé qui n'en a pas encore (inscription par mot de
  // passe, ou connexion Discord avec un email non vérifié) suffisait à hériter
  // de son accès.
  if (!user.email || !user.email_confirmed_at) redirect(denied);

  const { data: staff } = await admin
    .from("allow_staff_list")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (staff) return { user: { id: user.id, email: user.email }, admin };

  redirect(denied);
}

/** Raccourci historique : renvoie le client admin une fois l'accès validé. */
export async function assertStaff(): Promise<AdminClient> {
  const { admin } = await requireStaff();
  return admin;
}
