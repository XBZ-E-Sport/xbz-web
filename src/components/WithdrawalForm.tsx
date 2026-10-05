"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import Honeypot from "@/components/Honeypot";
import { useElapsed } from "@/hooks/useElapsed";
import { translateApiError } from "@/lib/formerror";
import { FIELD_MAX } from "@/lib/limits";
import { LEGAL } from "@/lib/legal";

// Fonction de rétractation en ligne, en DEUX temps comme l'exige la loi :
//  1. « Renoncer au contrat ici » : le client donne son nom, de quoi identifier sa
//     commande et l'adresse où recevoir l'accusé de réception, puis relit ;
//  2. « Confirmer la rétractation » : SEUL ce bouton envoie la déclaration.
// Le libellé de chaque bouton reste nu — aucun autre texte dedans, aucune case
// pré-cochée, aucun consentement groupé — et le texte explicatif est à côté.

const inputCls =
  "w-full rounded-lg border border-neutral-500 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-neutral-300";
const hintCls = "mt-1.5 text-[13px] leading-relaxed text-neutral-400";
const primaryBtn =
  "rounded-xl bg-xbz-blue px-7 py-3.5 text-center font-bold text-white transition hover:brightness-110 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 motion-safe:hover:-translate-y-0.5";
const secondaryBtn =
  "rounded-xl border border-white/20 px-7 py-3.5 text-center font-semibold text-neutral-200 transition hover:bg-white/5 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60";

/** Message de la réponse du serveur, déjà traduit : le seul qu'on montre tel quel au client. */
class ServerMessage extends Error {}

type Values = { nom: string; email: string; commande: string; details: string; website: string };
type Step = "form" | "review" | "done";

const EMPTY: Values = { nom: "", email: "", commande: "", details: "", website: "" };

export default function WithdrawalForm() {
  const t = useTranslations("withdrawal");
  const tErr = useTranslations("formErrors");
  const tField = useTranslations("fieldLabels");
  const locale = useLocale();
  const elapsed = useElapsed();

  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<Values>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receivedAt, setReceivedAt] = useState("");

  // À chaque changement d'étape, le titre prend le focus : un lecteur d'écran
  // annonce la nouvelle étape, un clavier repart du bon endroit.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  function handleStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const read = (k: string) => String(fd.get(k) ?? "").trim();
    setValues({
      nom: read("nom"),
      email: read("email"),
      commande: read("commande"),
      details: read("details"),
      // Le piège anti-bot voyage avec les autres champs : rempli, le serveur ignore l'envoi.
      website: read("website"),
    });
    setError("");
    setStep("review");
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/boutique/retractation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, elapsed: elapsed(), locale }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new ServerMessage(translateApiError(json, tErr, tField));
      // Horodatage du SERVEUR (celui de l'accusé), pas celui du navigateur.
      setReceivedAt(typeof json.receivedAt === "string" ? json.receivedAt : "");
      setStep("done");
    } catch (err) {
      // Réseau coupé, requête interrompue : le texte du navigateur (« Failed to fetch »,
      // en anglais et propre à chaque moteur) n'a rien à faire sous les yeux du client.
      setError(err instanceof ServerMessage ? err.message : tErr("generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const headingCls = "mb-3 font-display text-xl font-bold text-white outline-none sm:text-2xl";

  if (step === "done") {
    const when = receivedAt
      ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: "Europe/Paris",
        }).format(new Date(receivedAt))
      : "";
    return (
      <div role="status" className="flex flex-col gap-4 leading-relaxed text-neutral-300">
        <h2 ref={titleRef} tabIndex={-1} className={headingCls}>
          <span aria-hidden="true">✅ </span>
          {t("doneTitle")}
        </h2>
        <p className="font-semibold text-white">{t("doneReceived", { when })}</p>
        <p className="break-words">{t("doneAck", { email: values.email })}</p>
        <p>{t("doneNext", { returnAddress: LEGAL.returnAddress })}</p>
        <Link href="/boutique" className={`${primaryBtn} self-start`}>
          {t("doneBack")}
        </Link>
      </div>
    );
  }

  if (step === "review") {
    const rows: [string, string][] = [
      [t("reviewName"), values.nom],
      [t("reviewEmail"), values.email],
      [t("reviewOrder"), values.commande || t("reviewOrderNone")],
      [t("reviewDetails"), values.details || t("reviewDetailsNone")],
    ];
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 ref={titleRef} tabIndex={-1} className={headingCls}>
            {t("reviewTitle")}
          </h2>
          <p className="text-neutral-400">{t("reviewIntro")}</p>
        </div>
        <dl className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/3 p-5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
              <dd className="mt-0.5 whitespace-pre-line break-words text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setStep("form")} disabled={submitting} className={secondaryBtn}>
            {t("edit")}
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className={primaryBtn}>
            {submitting ? t("confirming") : t("confirm")}
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-red-500">
          {error && (
            <>
              <span aria-hidden="true">❌ </span>
              {error}
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleStart} className="flex flex-col gap-4">
      <Honeypot id="withdrawal-website" />
      <h2 ref={titleRef} tabIndex={-1} className="sr-only">
        {t("start")}
      </h2>

      <div>
        <label htmlFor="withdrawal-nom" className={labelCls}>
          {t("nameLabel")}
        </label>
        <input
          id="withdrawal-nom"
          name="nom"
          type="text"
          required
          maxLength={FIELD_MAX.nom}
          autoComplete="name"
          defaultValue={values.nom}
          placeholder={t("namePlaceholder")}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="withdrawal-email" className={labelCls}>
          {t("emailLabel")}
        </label>
        <input
          id="withdrawal-email"
          name="email"
          type="email"
          required
          maxLength={FIELD_MAX.email}
          autoComplete="email"
          defaultValue={values.email}
          placeholder={t("emailPlaceholder")}
          aria-describedby="withdrawal-email-hint"
          className={inputCls}
        />
        <p id="withdrawal-email-hint" className={hintCls}>
          {t("emailHint")}
        </p>
      </div>

      <div>
        <label htmlFor="withdrawal-commande" className={labelCls}>
          {t("orderLabel")}
        </label>
        <input
          id="withdrawal-commande"
          name="commande"
          type="text"
          maxLength={FIELD_MAX.commande}
          autoComplete="off"
          defaultValue={values.commande}
          placeholder={t("orderPlaceholder")}
          aria-describedby="withdrawal-commande-hint"
          className={inputCls}
        />
        <p id="withdrawal-commande-hint" className={hintCls}>
          {t("orderHint")}
        </p>
      </div>

      <div>
        <label htmlFor="withdrawal-details" className={labelCls}>
          {t("detailsLabel")}
        </label>
        <textarea
          id="withdrawal-details"
          name="details"
          rows={3}
          maxLength={FIELD_MAX.details}
          defaultValue={values.details}
          aria-describedby="withdrawal-details-hint"
          className={inputCls}
        />
        <p id="withdrawal-details-hint" className={hintCls}>
          {t("detailsHint")}
        </p>
      </div>

      <button type="submit" className={`${primaryBtn} mt-1`}>
        {t("start")}
      </button>

      <p className="text-[13px] leading-relaxed text-neutral-400">
        {t.rich("privacyNote", {
          privacy: (chunks) => (
            <Link href="/confidentialite" className="font-semibold text-xbz-cyan hover:underline">
              {chunks}
            </Link>
          ),
          cgv: (chunks) => (
            <Link href="/cgv#retractation" className="font-semibold text-xbz-cyan hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
