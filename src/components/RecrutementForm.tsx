"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-500 outline-none focus:ring-1 focus:ring-xbz-blue";
const labelCls = "mb-1.5 block text-sm font-semibold text-neutral-300";
const optionalCls = "font-normal text-neutral-500";

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
        throw new Error(json?.error ?? "Erreur lors de l’envoi.");
      }
      setStatus({ msg: "✅ Candidature envoyée avec succès !", tone: "ok" });
      form.reset();
      setJeu("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l’envoi.";
      setStatus({ msg: `❌ ${msg}`, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-nom" className={labelCls}>
            Nom et prénom
          </label>
          <input
            id="rec-nom"
            name="nom"
            type="text"
            required
            autoComplete="name"
            placeholder="Nom + Prénom"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="rec-age" className={labelCls}>
            Âge
          </label>
          <input
            id="rec-age"
            name="age"
            type="number"
            min={16}
            max={99}
            required
            placeholder="16 ans minimum"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-pays1" className={labelCls}>
            Pays de résidence
          </label>
          <input
            id="rec-pays1"
            name="pays1"
            type="text"
            required
            autoComplete="country-name"
            placeholder="France"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="rec-pays2" className={labelCls}>
            Pays de naissance
          </label>
          <input
            id="rec-pays2"
            name="pays2"
            type="text"
            required
            placeholder="France"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-discord" className={labelCls}>
            Pseudo Discord
          </label>
          <input
            id="rec-discord"
            name="discord"
            type="text"
            required
            placeholder="pseudo#0000"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="rec-pseudo" className={labelCls}>
            Pseudo en jeu
          </label>
          <input
            id="rec-pseudo"
            name="pseudo"
            type="text"
            required
            placeholder="Ton pseudo en jeu"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="rec-jeu" className={labelCls}>
          Jeu
        </label>
        <select
          id="rec-jeu"
          name="jeu"
          required
          value={jeu}
          onChange={(e) => setJeu(e.target.value)}
          className={inputCls}
        >
          <option value="">Sélectionne un jeu</option>
          <option value="Rocket League">Rocket League</option>
        </select>
      </div>

      {/* Champ RL Tracker affiché uniquement pour Rocket League */}
      {showRL && (
        <div>
          <label htmlFor="rec-rltracker" className={labelCls}>
            Lien RL Tracker <span className={optionalCls}>(recommandé)</span>
          </label>
          <input
            id="rec-rltracker"
            name="rltracker"
            type="url"
            placeholder="https://rocketleague.tracker.network/..."
            className={inputCls}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
            🔗 Le lien doit être cliquable, valide et accessible. Tout lien incorrect ou non
            fonctionnel pourra entraîner un refus de candidature.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="rec-rang" className={labelCls}>
          Rang <span className={optionalCls}>(facultatif)</span>
        </label>
        <input
          id="rec-rang"
          name="rang"
          type="text"
          placeholder="Ton rang actuel"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="rec-exp" className={labelCls}>
          Expérience <span className={optionalCls}>(facultatif)</span>
        </label>
        <textarea
          id="rec-exp"
          name="exp"
          rows={3}
          placeholder="Tes expériences passées (équipes, compétitions...)"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="rec-motiv" className={labelCls}>
          Motivation <span className={optionalCls}>(facultatif)</span>
        </label>
        <textarea
          id="rec-motiv"
          name="motiv"
          rows={4}
          placeholder="Pourquoi veux-tu rejoindre XBZ ?"
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:hover:-translate-y-0.5"
      >
        {submitting ? "Envoi..." : "Envoyer ma candidature"}
      </button>

      <p aria-live="polite" className={`min-h-5 text-center text-sm ${toneColor[status.tone]}`}>
        {status.msg}
      </p>
    </form>
  );
}
