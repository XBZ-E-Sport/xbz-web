"use server";

import { after } from "next/server";

// Garde d'autorisation partagée (@/lib/adminguard) : une seule implémentation
// pour TOUTES les server actions — une copie locale finirait par diverger.
import { requireStaff } from "@/lib/adminguard";
import { revalidateLocalizedPath } from "@/lib/cache";

// Aligné sur le bot Discord : ses boutons écrivent accepte/refuse/entretien.
const STATUTS = ["en_attente", "accepte", "refuse", "entretien"] as const;
type Statut = (typeof STATUTS)[number];

/**
 * URL de l'endpoint `/statut` du bot.
 * Déduite de `BOT_RECRUTEMENT_URL` (même hôte) sauf si `BOT_STATUT_URL` est
 * défini — pas de variable supplémentaire à configurer dans le cas courant.
 */
function botStatutUrl(): string | null {
  const explicit = process.env.BOT_STATUT_URL;
  if (explicit) return explicit;

  const recrutement = process.env.BOT_RECRUTEMENT_URL;
  if (!recrutement) return null;
  return recrutement.replace(/\/recrutement\/?$/, "/statut");
}

/**
 * Reflète le changement de statut sur le message Discord d'origine.
 * En arrière-plan : le staff ne doit pas attendre le bot (Render peut mettre
 * plusieurs secondes à se réveiller), et un bot éteint ne doit rien casser.
 */
function notifyBot(id: string, statut: string, by: string) {
  const url = botStatutUrl();
  if (!url) return;

  after(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.BOT_SHARED_SECRET
            ? { "x-xbz-secret": process.env.BOT_SHARED_SECRET }
            : {}),
        },
        body: JSON.stringify({ id, statut, by }),
        signal: AbortSignal.timeout(60000), // large : cold start Render
      });
      if (!res.ok) {
        console.error("[admin] le bot a répondu", res.status, await res.text().catch(() => ""));
      }
    } catch (e) {
      console.error("[admin] synchro Discord échouée:", e);
    }
  });
}

export async function updateStatut(formData: FormData) {
  const id = String(formData.get("id"));
  const statut = String(formData.get("statut"));

  if (!id || !STATUTS.includes(statut as Statut)) {
    throw new Error("Requête invalide.");
  }

  const { user, admin } = await requireStaff();

  const { error } = await admin.from("candidatures").update({ statut }).eq("id", id);
  if (error) throw new Error(error.message);

  // La base est la source de vérité ; Discord n'en est qu'un reflet.
  notifyBot(id, statut, user.email ?? "le staff");

  revalidateLocalizedPath("/admin");
}
