-- ============================================================
--  RGPD — preuve de consentement & rétention des données
--  Cibles : `candidatures` et `support_messages`.
--  À exécuter dans Supabase → SQL Editor. Idempotent (ré-exécutable sans risque).
-- ============================================================

-- 1) Preuve de consentement (RGPD art. 7 : « être en mesure de démontrer »).
--    Horodatage du consentement donné à l'envoi du formulaire. Nullable : les
--    lignes créées avant ce déploiement n'en ont pas.
alter table public.candidatures     add column if not exists consent_at timestamptz;
alter table public.support_messages add column if not exists consent_at timestamptz;

-- 2) Garantit la présence de `created_at` (socle de la purge par ancienneté).
--    NOT NULL + default now() : d'éventuelles lignes existantes sans cette
--    colonne sont horodatées à l'exécution (sans impact fonctionnel).
alter table public.candidatures     add column if not exists created_at timestamptz not null default now();
alter table public.support_messages add column if not exists created_at timestamptz not null default now();

-- 3) Index sur `created_at` : rend la purge efficace
--    (DELETE ... WHERE created_at < cutoff, lancé par /api/cron/purge).
create index if not exists candidatures_created_at_idx     on public.candidatures (created_at);
create index if not exists support_messages_created_at_idx on public.support_messages (created_at);
