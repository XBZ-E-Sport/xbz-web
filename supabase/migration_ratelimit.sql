-- ============================================================
--  RATE LIMITING — anti-flood des formulaires (recrutement / support)
--  Table technique écrite/lue uniquement par le back-end (service_role).
--  À exécuter dans Supabase → SQL Editor.
-- ============================================================

create table if not exists public.rate_limit_hits (
  id          uuid primary key default gen_random_uuid(),
  ip          text not null,
  route       text not null,
  created_at  timestamptz not null default now()
);

-- Index de recherche par IP + route sur la fenêtre glissante.
create index if not exists rate_limit_hits_lookup_idx
  on public.rate_limit_hits (ip, route, created_at);

-- RLS activée SANS policy : le public n'y a aucun accès ; seules les requêtes
-- service_role (les routes API) lisent/écrivent (elles contournent la RLS).
alter table public.rate_limit_hits enable row level security;
