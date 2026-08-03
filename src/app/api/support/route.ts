import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSpam } from "@/lib/antispam";
import { hasConsent } from "@/lib/consent";
import { findTooLong, tooLongMessage, FIELD_MAX } from "@/lib/limits";
import { apiError } from "@/lib/apierror";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

type Payload = {
  nom?: string;
  email?: string;
  sujet?: string;
  message?: string;
  // Consentement RGPD
  consent?: unknown;
  // Anti-spam
  website?: string;
  elapsed?: string;
};

const SUJETS = [
  "Général",
  "Recrutement",
  "Partenariat",
  "Signalement",
  "Presse",
  "Bug technique",
];

export async function POST(request: Request) {
  // --- Parsing ---
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }

  // --- Limite de débit (anti-flood par IP) ---
  const { allowed, retryAfter } = await checkRateLimit(getClientIp(request), "support");
  if (!allowed) {
    return apiError(429, "rateLimited", "Trop de tentatives. Réessaie dans une minute.", {
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  // --- Anti-spam (honeypot + délai minimum) ---
  const { spam, tooFast } = checkSpam(body);
  if (spam) {
    // Piège rempli : on répond OK sans rien enregistrer.
    return NextResponse.json({ ok: true });
  }
  if (tooFast) {
    return apiError(429, "tooFast", "Envoi trop rapide, réessaie dans un instant.");
  }

  // --- Consentement RGPD (obligatoire, validé côté serveur) ---
  if (!hasConsent(body.consent)) {
    return apiError(
      422,
      "consentRequired",
      "Tu dois accepter le traitement de tes données pour envoyer ton message.",
    );
  }

  const nom = String(body.nom ?? "").trim();
  const email = String(body.email ?? "").trim();
  const sujet = SUJETS.includes(String(body.sujet)) ? String(body.sujet) : "Général";
  const message = String(body.message ?? "").trim();

  // --- Validation serveur (on ne fait jamais confiance au navigateur) ---
  if (!nom || !email || !message) {
    return apiError(400, "missingFields", "Champs obligatoires manquants.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError(422, "invalidEmail", "Adresse email invalide.");
  }
  if (message.length < 10) {
    return apiError(422, "messageTooShort", "Ton message est trop court (10 caractères minimum).", {
      params: { min: 10 },
    });
  }
  // Longueurs maximales (le `maxLength` du navigateur se contourne).
  const tooLong = findTooLong({ nom, email, sujet, message });
  if (tooLong) {
    return apiError(422, "tooLong", tooLongMessage(tooLong), {
      params: { field: tooLong, max: FIELD_MAX[tooLong] },
    });
  }

  const supabase = createAdminClient();

  // --- 1) Persister le message (source de vérité) ---
  const { data, error } = await supabase
    .from("support_messages")
    .insert({ nom, email, sujet, message, consent_at: new Date().toISOString() })
    .select("id")
    .single();

  if (error) {
    console.error("[support] insert Supabase:", error.message);
    return apiError(500, "saveFailed", "Impossible d'envoyer le message pour le moment.");
  }

  // --- 2) Notifier le staff sur Discord EN ARRIÈRE-PLAN (optionnel) ---
  const botUrl = process.env.BOT_SUPPORT_URL;
  if (botUrl) {
    after(async () => {
      try {
        const res = await fetch(botUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.BOT_SHARED_SECRET
              ? { "x-xbz-secret": process.env.BOT_SHARED_SECRET }
              : {}),
          },
          // `id` : même contrat que la route recrutement (le bot l'affiche).
          body: JSON.stringify({ id: data.id, nom, email, sujet, message }),
          signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) {
          console.error("[support] le bot a répondu", res.status, await res.text().catch(() => ""));
        }
      } catch (e) {
        console.error("[support] notif Discord échouée:", e);
      }
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
