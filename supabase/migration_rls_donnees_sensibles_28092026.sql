-- ============================================================
--  RLS — tables de données personnelles et de contrôle d'accès
--  Cibles : `candidatures`, `support_messages`, `allow_staff_list`.
--  À exécuter dans Supabase → SQL Editor. Idempotent (ré-exécutable sans risque).
-- ============================================================
--
-- En prod, la RLS de ces trois tables a été activée à la main (Supabase affiche
-- « no RLS policies exist so no data will be returned ») mais aucune migration
-- ne le versionnait : une base recréée (projet de test de la CI, nouveau projet)
-- les aurait créées OUVERTES à la clé publique — candidatures de mineurs dès
-- 16 ans, messages de support, liste des emails du staff.
--
-- RLS activée SANS policy : la clé publique (anon / authenticated) n'y lit ni
-- n'écrit rien. Seul le back-end y accède, via la clé secrète (service_role),
-- qui contourne la RLS : formulaires, back-office, purge RGPD, garde admin.
-- Surtout n'ajoute PAS de policy de lecture publique sur ces tables.

alter table if exists public.candidatures     enable row level security;
alter table if exists public.support_messages enable row level security;
alter table if exists public.allow_staff_list enable row level security;

-- Vérification (doit renvoyer true pour les trois, et aucune policy) :
--   select relname, relrowsecurity from pg_class
--    where relname in ('candidatures', 'support_messages', 'allow_staff_list');
--   select tablename, policyname from pg_policies
--    where tablename in ('candidatures', 'support_messages', 'allow_staff_list');
