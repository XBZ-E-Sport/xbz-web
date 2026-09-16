-- ============================================================
--  XBZ Esport — Notifications Discord des matchs (v2.7)
--  À exécuter dans Supabase → SQL Editor.
--
--  Ajoute le suivi des rappels envoyés : `reminded_at` est renseigné quand le
--  rappel « match bientôt » a été posté sur Discord, pour ne jamais l'envoyer
--  deux fois. Le digest quotidien, lui, n'a besoin d'aucun suivi (il se base sur
--  la date du jour).
-- ============================================================

alter table public.matchs
  add column if not exists reminded_at timestamptz;
