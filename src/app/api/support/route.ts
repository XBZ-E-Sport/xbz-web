import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSpam } from "@/lib/antispam";
import { hasConsent } from "@/lib/consent";
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
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  // --- Limite de débit (anti-flood par IP) ---
  const { allowed, retryAfter } = await checkRateLimit(getClientIp(request), "support");
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Trop de tentatives. Réessaie dans une minute." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // --- Anti-spam (honeypot + délai minimum) ---
  const { spam, tooFast } = checkSpam(body);
  if (spam) {
    // Piège rempli : on répond OK sans rien enregistrer.
    return NextResponse.json({ ok: true });
  }
  if (tooFast) {
    return NextResponse.json(
      { ok: false, error: "Envoi trop rapide, réessaie dans un instant." },
      { status: 429 },
    );
  }

  // --- Consentement RGPD (obligatoire, validé côté serveur) ---
  if (!hasConsent(body.consent)) {
    return NextResponse.json(
      { ok: false, error: "Tu dois accepter le traitement de tes données pour envoyer ton message." },
      { status: 422 },
    );
  }

  const nom = String(body.nom ?? "").trim();
  const email = String(body.email ?? "").trim();
  const sujet = SUJETS.includes(String(body.sujet)) ? String(body.sujet) : "Général";
  const message = String(body.message ?? "").trim();

  // --- Validation serveur (on ne fait jamais confiance au navigateur) ---
  if (!nom || !email || !message) {
    return NextResponse.json(
      { ok: false, error: "Champs obligatoires manquants." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Adresse email invalide." }, { status: 422 });
  }
  if (message.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Ton message est trop court (10 caractères minimum)." },
      { status: 422 },
    );
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
    return NextResponse.json(
      { ok: false, error: "Impossible d'envoyer le message pour le moment." },
      { status: 500 },
    );
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
          body: JSON.stringify({ nom, email, sujet, message }),
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
