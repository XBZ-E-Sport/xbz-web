"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  recrutementCategories,
  minAgeForCategory,
  type RecrutementCategory,
} from "@/content/recrutement";
import Honeypot from "@/components/Honeypot";
import { useElapsed } from "@/hooks/useElapsed";
import { FIELD_MAX } from "@/lib/limits";
import { translateApiError } from "@/lib/formerror";

type RolesByCategory = Record<RecrutementCategory, { name: string; free: number }[]>;
type RosterOption = { name: string; rank: string | null };

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-neutral-300";
const optionalCls = "font-normal text-neutral-400";

type Tone = "idle" | "loading" | "ok" | "error";
const toneColor: Record<Tone, string> = {
  idle: "",
  loading: "text-amber-400",
  ok: "text-emerald-400",
  error: "text-red-500",
};

export default function RecrutementForm({
  rolesByCategory,
  rosters,
}: {
  rolesByCategory: RolesByCategory;
  rosters: RosterOption[];
}) {
  const t = useTranslations("recrutementForm");
  const tErr = useTranslations("formErrors");
  const tField = useTranslations("fieldLabels");
  const tCat = useTranslations("recrutementCategories");
  // Les rôles ouverts viennent de la base (colonne `recrute`). On traduit le
  // LIBELLÉ, jamais la valeur soumise : le serveur la revalide telle quelle
  // contre `isRoleOpen`, en français.
  const tRole = useTranslations("playerRoles");
  const [categorie, setCategorie] = useState("");
  const [role, setRole] = useState("");
  const [jeu, setJeu] = useState("");
  const [status, setStatus] = useState<{ msg: string; tone: Tone }>({ msg: "", tone: "idle" });
  const [submitting, setSubmitting] = useState(false);
  // Anti-spam : temps de remplissage depuis le montage (rejet serveur si trop rapide).
  const elapsed = useElapsed();

  const isEsport = categorie === "XBZ Esport";
  const showRL = isEsport && jeu === "Rocket League";
  // Âge minimum selon la catégorie : 18 ans pour le staff, 16 sinon.
  const minAge = minAgeForCategory(categorie);
  // On ne propose que les rôles avec de la disponibilité (postes ouverts).
  const roles = rolesByCategory[categorie as RecrutementCategory] ?? [];
  const noOpenRole = Boolean(categorie) && roles.length === 0;

  function handleCategorie(value: string) {
    setCategorie(value);
    setRole(""); // le rôle dépend de la catégorie : on le réinitialise
    setJeu(""); // le jeu ne concerne que l'Esport
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Âge minimum selon la catégorie (16 ans, 18 pour le staff).
    if (Number(fd.get("age")) < minAge) {
      setStatus({ msg: `❌ ${t("ageTooLow", { minAge })}`, tone: "error" });
      return;
    }

    const data = Object.fromEntries(fd.entries());
    data.elapsed = elapsed();
    setSubmitting(true);
    setStatus({ msg: `⏳ ${t("sending")}`, tone: "loading" });

    try {
      const res = await fetch("/api/recrutement", {
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
      setCategorie("");
      setRole("");
      setJeu("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : tErr("generic");
      setStatus({ msg: `❌ ${msg}`, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Honeypot id="rec-website" />

      {/* Catégorie + rôle */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-categorie" className={labelCls}>
            {t("category")}
          </label>
          <select
            id="rec-categorie"
            name="categorie"
            required
            value={categorie}
            onChange={(e) => handleCategorie(e.target.value)}
            className={inputCls}
          >
            <option value="" disabled hidden>
              {t("categoryPlaceholder")}
            </option>
            {recrutementCategories.map((c) => (
              <option key={c} value={c}>
                {tCat(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rec-role" className={labelCls}>
            {t("role")}
          </label>
          <select
            id="rec-role"
            name="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!categorie || noOpenRole}
            aria-describedby={noOpenRole ? "rec-role-empty" : undefined}
            className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="" disabled hidden>
              {!categorie
                ? t("rolePickCategoryFirst")
                : noOpenRole
                  ? t("roleNoneOpen")
                  : t("rolePlaceholder")}
            </option>
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {tRole.has(r.name) ? tRole(r.name) : r.name}
              </option>
            ))}
          </select>
          {noOpenRole && (
            <p id="rec-role-empty" className="mt-2 text-[13px] leading-relaxed text-neutral-400">
              {t("roleNoneOpenHelp")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-nom" className={labelCls}>
            {t("name")}
          </label>
          <input
            id="rec-nom"
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
          <label htmlFor="rec-age" className={labelCls}>
            {t("age")}
          </label>
          <input
            id="rec-age"
            name="age"
            type="number"
            min={minAge}
            max={99}
            required
            placeholder={t("agePlaceholder", { minAge })}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="rec-pays1" className={labelCls}>
          {t("country")}
        </label>
        <input
          id="rec-pays1"
          name="pays1"
          maxLength={FIELD_MAX.pays}
          type="text"
          required
          autoComplete="country-name"
          placeholder="France"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-discord" className={labelCls}>
            {t("discord")}
          </label>
          <input
            id="rec-discord"
            name="discord"
            maxLength={FIELD_MAX.discord}
            type="text"
            required
            placeholder="pseudo_discord"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="rec-pseudo" className={labelCls}>
            {t("pseudo")}
          </label>
          <input
            id="rec-pseudo"
            name="pseudo"
            maxLength={FIELD_MAX.pseudo}
            type="text"
            required
            placeholder="pseudo_perso"
            className={inputCls}
          />
        </div>
      </div>

      {/* Champs spécifiques à l'Esport */}
      {isEsport && (
        <>
          <div>
            <label htmlFor="rec-jeu" className={labelCls}>
              {t("game")}
            </label>
            <select
              id="rec-jeu"
              name="jeu"
              required
              value={jeu}
              onChange={(e) => setJeu(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled hidden>
                {t("gamePlaceholder")}
              </option>
              <option value="Rocket League">Rocket League</option>
            </select>
          </div>

          {showRL && (
            <div>
              <label htmlFor="rec-rltracker" className={labelCls}>
                {t("rltracker")}{" "}
                <span className={optionalCls}>({t("recommended")})</span>
              </label>
              <input
                id="rec-rltracker"
                name="rltracker"
                maxLength={FIELD_MAX.rltracker}
                type="url"
                placeholder="https://rocketleague.tracker.network/..."
                className={inputCls}
              />
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                🔗 {t("rltrackerHelp")}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="rec-roster" className={labelCls}>
              {t("roster")} <span className={optionalCls}>({t("optional")})</span>
            </label>
            {/* Rosters lus en base (même système que les rôles). Valeur = nom du
                roster, stockée dans la colonne `roster` de la candidature. */}
            <select id="rec-roster" name="roster" defaultValue="" className={inputCls}>
              <option value="" disabled hidden>
                {t("rosterPlaceholder")}
              </option>
              {rosters.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.rank ? `${r.name} (${r.rank})` : r.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor="rec-exp" className={labelCls}>
          {t("experience")} <span className={optionalCls}>({t("optional")})</span>
        </label>
        <textarea
          id="rec-exp"
          name="exp"
          maxLength={FIELD_MAX.exp}
          rows={3}
          placeholder={t("experiencePlaceholder")}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="rec-motiv" className={labelCls}>
          {t("motivation")} <span className={optionalCls}>({t("optional")})</span>
        </label>
        <textarea
          id="rec-motiv"
          name="motiv"
          maxLength={FIELD_MAX.motiv}
          rows={4}
          placeholder={t("motivationPlaceholder")}
          className={inputCls}
        />
      </div>

      {/* Consentement RGPD (obligatoire). Non coché par défaut. */}
      <div className="flex items-start gap-3">
        <input
          id="rec-consent"
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-xbz-blue"
        />
        <label htmlFor="rec-consent" className="text-[13px] leading-relaxed text-neutral-400">
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
