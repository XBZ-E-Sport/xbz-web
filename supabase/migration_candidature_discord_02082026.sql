-- ============================================================
--  Lien candidature ↔ message Discord
--
--  Permet au back-office de RÉÉCRIRE le message Discord d'origine quand le
--  staff change un statut depuis /admin. Sans ces colonnes, le bot ne sait pas
--  quel message éditer : la candidature restait affichée « en attente » sur
--  Discord avec ses boutons, même une fois refusée sur le site.
--
--  Remplies par le bot au moment où il poste la candidature.
--  À exécuter dans Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.candidatures add column if not exists discord_message_id text;
alter table public.candidatures add column if not exists discord_channel_id text;

-- PostgREST met le schéma en cache : sans ce rechargement, les écritures du bot
-- échoueraient sur « Could not find the column … in the schema cache ».
notify pgrst, 'reload schema';
