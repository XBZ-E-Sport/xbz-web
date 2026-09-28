import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRoleOpen } from "@/lib/equipes";
import { minAgeForCategory } from "@/content/recrutement";
import { checkSpam } from "@/lib/antispam";
import { hasConsent } from "@/lib/consent";
import { findTooLong, tooLongMessage, textField, FIELD_MAX } from "@/lib/limits";
import { apiError } from "@/lib/apierror";
import { defuseMentions } from "@/lib/mentions";
import { checkFormRateLimit, getClientIp } from "@/lib/ratelimit";

type Payload = {
  categorie?: string;
  role?: string;
  nom?: string;
  age?: string | number;
  pays1?: string;
  discord?: string;
  pseudo?: string;
  jeu?: string;
  rltracker?: string;
  roster?: string;
  exp?: string;
  motiv?: string;
  // Consentement RGPD
  consent?: unknown;
  // Anti-spam
  website?: string;
  elapsed?: string;
};

export async function POST(request: Request) {
  // --- Parsing ---
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }

  // --- Limite de débit (anti-flood par IP) ---
  const { allowed, retryAfter } = await checkFormRateLimit(getClientIp(request), "recrutement");
  if (!allowed) {
    return apiError(429, "rateLimited", "Trop de tentatives. Réessaie dans une minute.", {
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  // --- Anti-spam (honeypot + délai minimum) ---
  const { spam, tooFast } = checkSpam(body);
  if (spam) {
    // Piège rempli : on répond OK sans rien enregistrer (le bot n'apprend rien).
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
      "Tu dois accepter le traitement de tes données pour envoyer ta candidature.",
    );
  }

  // --- Validation serveur (on ne fait JAMAIS confiance au navigateur) ---
  // Chaque champ texte DOIT être une chaîne : un tableau ou un objet est
  // refusé ici, avant le contrôle des longueurs (cf. `textField`).
  const fields = {
    categorie: textField(body.categorie),
    role: textField(body.role),
    nom: textField(body.nom),
    discord: textField(body.discord),
    pseudo: textField(body.pseudo),
    jeu: textField(body.jeu),
    pays: textField(body.pays1),
    roster: textField(body.roster),
    rltracker: textField(body.rltracker),
    exp: textField(body.exp),
    motiv: textField(body.motiv),
  };
  if (Object.values(fields).some((v) => v === null)) {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }
  const { categorie, role, nom, discord, pseudo, jeu, pays, roster, rltracker, exp, motiv } =
    fields as Record<keyof typeof fields, string>;

  // Âge : un entier plausible, saisi en nombre ou en texte (« 17 »).
  const age = typeof body.age === "number" || typeof body.age === "string" ? Number(body.age) : NaN;
  if (!categorie || !role || !nom || !discord || !pseudo || Number.isNaN(age)) {
    return apiError(400, "missingFields", "Champs obligatoires manquants.");
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    return apiError(400, "invalidRequest", "Requête invalide.");
  }

  // Longueurs : le `maxLength` du navigateur se contourne en deux clics.
  const tooLong = findTooLong({ nom, pseudo, discord, jeu, pays, roster, rltracker, exp, motiv });
  if (tooLong) {
    return apiError(422, "tooLong", tooLongMessage(tooLong), {
      params: { field: tooLong, max: FIELD_MAX[tooLong] },
    });
  }
  if (!(await isRoleOpen(categorie, role))) {
    return apiError(422, "roleUnavailable", "Ce rôle n'est pas disponible au recrutement.");
  }
  const minAge = minAgeForCategory(categorie);
  if (age < minAge) {
    return apiError(422, "ageMin", `Âge minimum requis : ${minAge} ans.`, {
      params: { minAge },
    });
  }
  // Le jeu n'est requis que pour une candidature Esport
  if (categorie === "XBZ Esport" && !jeu) {
    return apiError(422, "gameRequired", "Le jeu est requis pour une candidature Esport.");
  }

  const supabase = createAdminClient();

  // --- 1) Persister la candidature (source de vérité) ---
  const { data, error } = await supabase
    .from("candidatures")
    .insert({
      categorie,
      role,
      nom,
      age,
      pays_residence: pays || null,
      discord,
      pseudo,
      jeu: jeu || null,
      rltracker: rltracker || null,
      roster: roster || null,
      experience: exp || null,
      motivation: motiv || null,
      consent_at: new Date().toISOString(), // preuve de consentement RGPD
    })
    .select("id")
    .single();

  if (error) {
    console.error("[recrutement] insert Supabase:", error.message);
    return apiError(500, "saveFailed", "Impossible d'enregistrer la candidature.");
  }

  // --- 2) Notifier le staff sur Discord EN ARRIÈRE-PLAN (ne bloque pas la réponse) ---
  const botUrl = process.env.BOT_RECRUTEMENT_URL;
  if (botUrl) {
    // Valeurs VALIDÉES uniquement (jamais le corps brut) : chaînes bornées,
    // mentions Discord neutralisées. Un champ facultatif vide est omis (le bot
    // affiche alors « N/A », comme pour une chaîne vide).
    const text = (v: string) => (v ? defuseMentions(v) : undefined);
    const notif = {
      id: data.id,
      categorie,
      role,
      nom: defuseMentions(nom),
      age: String(age),
      pays1: text(pays),
      discord: defuseMentions(discord),
      pseudo: defuseMentions(pseudo),
      jeu: defuseMentions(jeu),
      // Le bot lit `roster` en priorité et retombe sur `rang` : on envoie les
      // deux le temps de la transition, `rang` pourra disparaître ensuite.
      roster: text(roster),
      rang: text(roster),
      exp: text(exp),
      motiv: text(motiv),
      rltracker: text(rltracker),
    };
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
          body: JSON.stringify(notif),
          signal: AbortSignal.timeout(60000), // large : le bot Render peut être en cold start
        });
        if (!res.ok) {
          console.error("[recrutement] le bot a répondu", res.status, await res.text().catch(() => ""));
        }
      } catch (e) {
        console.error("[recrutement] notif Discord échouée:", e);
      }
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
