"use client";

import { useState } from "react";

import {
  recrutementCategories,
  minAgeForCategory,
  type RecrutementCategory,
} from "@/content/recrutement";
import Honeypot from "@/components/Honeypot";
import { useElapsed } from "@/hooks/useElapsed";

type RolesByCategory = Record<RecrutementCategory, { name: string; free: number }[]>;
type RosterOption = { name: string; rank: string | null };

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-500 outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-neutral-300";
const optionalCls = "font-normal text-neutral-500";

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
      setStatus({
        msg: `❌ Tu dois avoir au minimum ${minAge} ans pour cette catégorie.`,
        tone: "error",
      });
      return;
    }

    const data = Object.fromEntries(fd.entries());
    data.elapsed = elapsed();
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
      setCategorie("");
      setRole("");
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
      <Honeypot id="rec-website" />

      {/* Catégorie + rôle */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-categorie" className={labelCls}>
            Catégorie
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
              Choisis une catégorie
            </option>
            {recrutementCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rec-role" className={labelCls}>
            Rôle souhaité
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
                ? "Choisis d’abord une catégorie"
                : noOpenRole
                  ? "Aucun poste ouvert pour le moment"
                  : "Choisis un rôle"}
            </option>
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          {noOpenRole && (
            <p id="rec-role-empty" className="mt-2 text-[13px] leading-relaxed text-neutral-400">
              Aucun poste n’est ouvert dans cette catégorie actuellement. Reviens bientôt ou
              contacte-nous sur Discord.
            </p>
          )}
        </div>
      </div>

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
            min={minAge}
            max={99}
            required
            placeholder={`${minAge} ans minimum`}
            className={inputCls}
          />
        </div>
      </div>

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
            placeholder="pseudo_discord"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="rec-pseudo" className={labelCls}>
            Pseudo
          </label>
          <input
            id="rec-pseudo"
            name="pseudo"
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
              <option value="" disabled hidden>
                Sélectionne un jeu
              </option>
              <option value="Rocket League">Rocket League</option>
            </select>
          </div>

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
              Roster souhaité <span className={optionalCls}>(facultatif)</span>
            </label>
            {/* Rosters lus en base (même système que les rôles). Valeur = nom du
                roster, stockée dans la colonne `rang` de la candidature. */}
            <select id="rec-rang" name="rang" defaultValue="" className={inputCls}>
              <option value="" disabled hidden>
                Sans préférence
              </option>
              {rosters.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.rank ? `${r.name}` : r.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor="rec-exp" className={labelCls}>
          Expérience <span className={optionalCls}>(facultatif)</span>
        </label>
        <textarea
          id="rec-exp"
          name="exp"
          rows={3}
          placeholder="Tes expériences passées (équipes, compétitions, contenus...)"
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
          J’accepte que les informations transmises soient utilisées par XBZ Esport pour traiter
          ma candidature et me recontacter. Voir la{" "}
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
        {submitting ? "Envoi..." : "Envoyer ma candidature"}
      </button>

      <p aria-live="polite" className={`min-h-5 text-center text-sm ${toneColor[status.tone]}`}>
        {status.msg}
      </p>
    </form>
  );
}
