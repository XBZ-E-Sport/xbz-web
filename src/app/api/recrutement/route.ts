import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Payload = {
  nom?: string;
  age?: string | number;
  pays1?: string;
  pays2?: string;
  discord?: string;
  pseudo?: string;
  jeu?: string;
  rltracker?: string;
  rang?: string;
  exp?: string;
  motiv?: string;
};

export async function POST(request: Request) {
  // --- Parsing ---
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const nom = String(body.nom ?? "").trim();
  const age = Number(body.age);
  const discord = String(body.discord ?? "").trim();
  const pseudo = String(body.pseudo ?? "").trim();
  const jeu = String(body.jeu ?? "").trim();

  // --- Validation serveur (on ne fait JAMAIS confiance au navigateur) ---
  if (!nom || !discord || !pseudo || !jeu || Number.isNaN(age)) {
    return NextResponse.json({ ok: false, error: "Champs obligatoires manquants." }, { status: 400 });
  }
  if (age < 16) {
    return NextResponse.json({ ok: false, error: "Âge minimum requis : 16 ans." }, { status: 422 });
  }

  const supabase = createAdminClient();

  // --- 1) Persister la candidature (source de vérité) ---
  const { data, error } = await supabase
    .from("candidatures")
    .insert({
      nom,
      age,
      pays_residence: String(body.pays1 ?? "").trim() || null,
      pays_naissance: String(body.pays2 ?? "").trim() || null,
      discord,
      pseudo,
      jeu,
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

  // --- 2) Notifier le staff sur Discord (best-effort) ---
  const botUrl = process.env.BOT_RECRUTEMENT_URL;
  if (botUrl) {
    try {
      await fetch(botUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.BOT_SHARED_SECRET
            ? { "x-xbz-secret": process.env.BOT_SHARED_SECRET }
            : {}),
        },
        // On renvoie au bot le même format que l'ancien site pour son embed
        body: JSON.stringify({
          nom,
          age,
          pays1: body.pays1,
          pays2: body.pays2,
          discord,
          pseudo,
          jeu,
          rang: body.rang,
          exp: body.exp,
          motiv: body.motiv,
          rltracker: body.rltracker,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      // Le bot dort (cold start) ou est down : pas grave, la candidature est déjà sauvegardée.
      console.error("[recrutement] notif Discord échouée:", e);
    }
  }

  return NextResponse.json({ ok: true, id: data.id });
}