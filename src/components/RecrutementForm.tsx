"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-500 outline-none focus:ring-1 focus:ring-xbz-blue";

type Tone = "idle" | "loading" | "ok" | "error";
const toneColor: Record<Tone, string> = {
  idle: "",
  loading: "text-amber-400",
  ok: "text-emerald-400",
  error: "text-red-500",
};

export default function RecrutementForm() {
  const [jeu, setJeu] = useState("");
  const [status, setStatus] = useState<{ msg: string; tone: Tone }>({ msg: "", tone: "idle" });
  const [submitting, setSubmitting] = useState(false);

  const showRL = jeu === "Rocket League";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Règle métier reprise de l'ancien site : 16 ans minimum
    if (Number(fd.get("age")) < 16) {
      setStatus({ msg: "❌ Tu dois avoir au minimum 16 ans pour rejoindre XBZ.", tone: "error" });
      return;
    }

    const data = Object.fromEntries(fd.entries());
    setSubmitting(true);
    setStatus({ msg: "⏳ Envoi en cours...", tone: "loading" });

    try {
      const res = await fetch("/api/recrutement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Erreur lors de l'envoi.");
      }
      setStatus({ msg: "✅ Candidature envoyée avec succès !", tone: "ok" });
      form.reset();
      setJeu("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi.";
      setStatus({ msg: `❌ ${msg}`, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input name="nom" type="text" placeholder="Nom + Prénom" required className={inputCls} />
      <input name="age" type="number" min={0} placeholder="Âge" required className={inputCls} />
      <input name="pays1" type="text" placeholder="Pays résidence" required className={inputCls} />
      <input name="pays2" type="text" placeholder="Pays naissance" required className={inputCls} />
      <input name="discord" type="text" placeholder="Discord" required className={inputCls} />
      <input name="pseudo" type="text" placeholder="Pseudo jeu" required className={inputCls} />

      <select
        name="jeu"
        required
        value={jeu}
        onChange={(e) => setJeu(e.target.value)}
        className={inputCls}
      >
        <option value="">Jeu</option>
        <option value="Rocket League">Rocket League</option>
        <option value="Warzone">Warzone</option>
      </select>

      {/* Champ RL Tracker affiché uniquement pour Rocket League */}
      {showRL && (
        <>
          <input name="rltracker" type="url" placeholder="Lien RL Tracker" className={inputCls} />
          <p className="max-w-lg text-center text-[13px] leading-relaxed text-neutral-400">
            🔗 <strong>RL Tracker :</strong> le lien doit être cliquable, valide et accessible. Tout
            lien incorrect ou non fonctionnel pourra entraîner un refus de candidature.
          </p>
        </>
      )}

      <input name="rang" type="text" placeholder="Rang" className={inputCls} />
      <textarea name="exp" placeholder="Expérience" rows={3} className={inputCls} />
      <textarea name="motiv" placeholder="Motivation" rows={4} className={inputCls} />

      <button
        type="submit"
        disabled={submitting}
        className="btn-xbz mt-2 w-full text-center disabled:opacity-60"
      >
        {submitting ? "Envoi..." : "Envoyer candidature"}
      </button>

      {status.msg && <p className={`mt-1 text-center text-sm ${toneColor[status.tone]}`}>{status.msg}</p>}
    </form>
  );
}