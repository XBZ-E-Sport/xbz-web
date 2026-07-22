"use client";

import { useEffect, useRef, useState } from "react";

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-500 outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-neutral-300";

type Tone = "idle" | "loading" | "ok" | "error";
const toneColor: Record<Tone, string> = {
  idle: "",
  loading: "text-amber-400",
  ok: "text-emerald-400",
  error: "text-red-500",
};

const SUJETS = ["Général", "Recrutement", "Partenariat", "Signalement", "Presse", "Bug technique"];

export default function SupportForm() {
  const [status, setStatus] = useState<{ msg: string; tone: Tone }>({ msg: "", tone: "idle" });
  const [submitting, setSubmitting] = useState(false);
  // Anti-spam : instant où le formulaire devient interactif.
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    // Temps de remplissage (le serveur rejette un envoi trop rapide = bot).
    data.elapsed = mountedAt.current ? String(Date.now() - mountedAt.current) : "";

    setSubmitting(true);
    setStatus({ msg: "⏳ Envoi en cours...", tone: "loading" });

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Erreur lors de l’envoi.");
      }
      setStatus({ msg: "✅ Message envoyé ! Le staff te répondra bientôt.", tone: "ok" });
      form.reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l’envoi.";
      setStatus({ msg: `❌ ${msg}`, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Anti-spam : piège invisible. Un humain ne remplit jamais ce champ. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="support-website">Ne pas remplir</label>
        <input id="support-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="support-nom" className={labelCls}>
          Nom / Pseudo
        </label>
        <input
          id="support-nom"
          name="nom"
          type="text"
          required
          autoComplete="name"
          placeholder="Ton nom ou pseudo"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="support-email" className={labelCls}>
          Email
        </label>
        <input
          id="support-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ton@email.com"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="support-sujet" className={labelCls}>
          Sujet
        </label>
        <select id="support-sujet" name="sujet" defaultValue="Général" className={inputCls}>
          {SUJETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-message" className={labelCls}>
          Message
        </label>
        <textarea
          id="support-message"
          name="message"
          rows={5}
          required
          minLength={10}
          placeholder="Explique ta demande en quelques lignes..."
          className={inputCls}
        />
      </div>

      {/* Consentement RGPD (obligatoire). Non coché par défaut. */}
      <div className="flex items-start gap-3">
        <input
          id="support-consent"
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-xbz-blue"
        />
        <label htmlFor="support-consent" className="text-[13px] leading-relaxed text-neutral-400">
          J’accepte que les informations transmises soient utilisées par XBZ Esport pour traiter
          ma demande et me répondre. Voir la{" "}
          <a
            href="/confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-xbz-cyan hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 motion-safe:hover:-translate-y-0.5"
      >
        {submitting ? "Envoi..." : "Envoyer le message"}
      </button>

      <p aria-live="polite" className={`min-h-5 text-center text-sm ${toneColor[status.tone]}`}>
        {status.msg}
      </p>
    </form>
  );
}
