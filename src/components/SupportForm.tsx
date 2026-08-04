"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import Honeypot from "@/components/Honeypot";
import { useElapsed } from "@/hooks/useElapsed";
import { FIELD_MAX } from "@/lib/limits";
import { translateApiError } from "@/lib/formerror";

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-neutral-300";

type Tone = "idle" | "loading" | "ok" | "error";
const toneColor: Record<Tone, string> = {
  idle: "",
  loading: "text-amber-400",
  ok: "text-emerald-400",
  error: "text-red-500",
};

// Valeurs envoyées au serveur (liste blanche côté route) : elles ne changent
// PAS avec la langue, seul leur libellé affiché est traduit.
const SUJETS = ["Général", "Recrutement", "Partenariat", "Signalement", "Presse", "Bug technique"];

export default function SupportForm() {
  const t = useTranslations("supportForm");
  const tErr = useTranslations("formErrors");
  const tField = useTranslations("fieldLabels");
  const tSujet = useTranslations("supportSubjects");
  const [status, setStatus] = useState<{ msg: string; tone: Tone }>({ msg: "", tone: "idle" });
  const [submitting, setSubmitting] = useState(false);
  // Anti-spam : temps de remplissage depuis le montage (rejet serveur si trop rapide).
  const elapsed = useElapsed();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.elapsed = elapsed();

    setSubmitting(true);
    setStatus({ msg: `⏳ ${t("sending")}`, tone: "loading" });

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(translateApiError(json, tErr, tField));
      }
      setStatus({ msg: `✅ ${t("success")}`, tone: "ok" });
      form.reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : tErr("generic");
      setStatus({ msg: `❌ ${msg}`, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Honeypot id="support-website" />

      <div>
        <label htmlFor="support-nom" className={labelCls}>
          {t("name")}
        </label>
        <input
          id="support-nom"
          name="nom"
          maxLength={FIELD_MAX.nom}
          type="text"
          required
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="support-email" className={labelCls}>
          {t("email")}
        </label>
        <input
          id="support-email"
          name="email"
          maxLength={FIELD_MAX.email}
          type="email"
          required
          autoComplete="email"
          placeholder="ton@email.com"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="support-sujet" className={labelCls}>
          {t("subject")}
        </label>
        <select id="support-sujet" name="sujet" defaultValue="Général" className={inputCls}>
          {SUJETS.map((s) => (
            <option key={s} value={s}>
              {tSujet(s)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-message" className={labelCls}>
          {t("message")}
        </label>
        <textarea
          id="support-message"
          name="message"
          maxLength={FIELD_MAX.message}
          rows={5}
          required
          minLength={10}
          placeholder={t("messagePlaceholder")}
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
          {t.rich("consent", {
            privacy: (chunks) => (
              <Link
                href="/confidentialite"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-xbz-cyan hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 motion-safe:hover:-translate-y-0.5"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>

      <p aria-live="polite" className={`min-h-5 text-center text-sm ${toneColor[status.tone]}`}>
        {status.msg}
      </p>
    </form>
  );
}
