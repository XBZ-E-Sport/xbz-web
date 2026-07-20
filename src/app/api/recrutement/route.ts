import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRoleOpen } from "@/lib/equipes";
import { checkSpam } from "@/lib/antispam";

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
  rang?: string;
  exp?: string;
  motiv?: string;
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
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  // --- Anti-spam (honeypot + délai minimum) ---
  const { spam, tooFast } = checkSpam(body);
  if (spam) {
    // Piège rempli : on répond OK sans rien enregistrer (le bot n'apprend rien).
    return NextResponse.json({ ok: true });
  }
  if (tooFast) {
    return NextResponse.json(
      { ok: false, error: "Envoi trop rapide, réessaie dans un instant." },
      { status: 429 },
    );
  }

  const categorie = String(body.categorie ?? "").trim();
  const role = String(body.role ?? "").trim();
  const nom = String(body.nom ?? "").trim();
  const age = Number(body.age);
  const discord = String(body.discord ?? "").trim();
  const pseudo = String(body.pseudo ?? "").trim();
  const jeu = String(body.jeu ?? "").trim();

  // --- Validation serveur (on ne fait JAMAIS confiance au navigateur) ---
  if (!categorie || !role || !nom || !discord || !pseudo || Number.isNaN(age)) {
    return NextResponse.json({ ok: false, error: "Champs obligatoires manquants." }, { status: 400 });
  }
  if (!(await isRoleOpen(categorie, role))) {
    return NextResponse.json(
      { ok: false, error: "Ce rôle n'est pas disponible au recrutement." },
      { status: 422 },
    );
  }
  if (age < 16) {
    return NextResponse.json({ ok: false, error: "Âge minimum requis : 16 ans." }, { status: 422 });
  }
  // Le jeu n'est requis que pour une candidature Esport
  if (categorie === "XBZ Esport" && !jeu) {
    return NextResponse.json(
      { ok: false, error: "Le jeu est requis pour une candidature Esport." },
      { status: 422 },
    );
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
      pays_residence: String(body.pays1 ?? "").trim() || null,
      discord,
      pseudo,
      jeu: jeu || null,
      rltracker: String(body.rltracker ?? "").trim() || null,
      rang: String(body.rang ?? "").trim() || null,
      experience: String(body.exp ?? "").trim() || null,
      motivation: String(body.motiv ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[recrutement] insert Supabase:", error.message);
    return NextResponse.json(
      { ok: false, error: "Impossible d'enregistrer la candidature." },
      { status: 500 }
    );
  }

  // --- 2) Notifier le staff sur Discord EN ARRIÈRE-PLAN (ne bloque pas la réponse) ---
  const botUrl = process.env.BOT_RECRUTEMENT_URL;
  if (botUrl) {
    const notif = {
      categorie,
      role,
      nom,
      age: String(age),
      pays1: body.pays1,
      discord,
      pseudo,
      jeu,
      rang: body.rang,
      exp: body.exp,
      motiv: body.motiv,
      rltracker: body.rltracker,
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
