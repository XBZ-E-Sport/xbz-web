-- =============================================================================
--  XBZ — migrations à passer AVANT le déploiement
--  Supabase › SQL Editor › coller ce bloc entier › Run.
--  Idempotent : ré-exécutable sans risque, ne touche à aucune donnée existante.
-- =============================================================================

-- 1) RGPD : preuve de consentement + socle de la purge par ancienneté ---------
alter table public.candidatures     add column if not exists consent_at timestamptz;
alter table public.support_messages add column if not exists consent_at timestamptz;

alter table public.candidatures     add column if not exists created_at timestamptz not null default now();
alter table public.support_messages add column if not exists created_at timestamptz not null default now();

create index if not exists candidatures_created_at_idx     on public.candidatures (created_at);
create index if not exists support_messages_created_at_idx on public.support_messages (created_at);

-- 2) Renommage `rang` → `roster` sur les candidatures ------------------------
--    (à ne pas confondre avec joueurs.rang, le vrai rang d'un joueur)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidatures' and column_name = 'rang'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidatures' and column_name = 'roster'
  ) then
    alter table public.candidatures rename column rang to roster;
  end if;
end $$;

-- Filet : si la table n'a jamais eu de colonne `rang`, on crée `roster`.
alter table public.candidatures add column if not exists roster text;

-- 3) Table anti-flood (rate limiting) ----------------------------------------
create table if not exists public.rate_limit_hits (
  id          uuid primary key default gen_random_uuid(),
  ip          text not null,
  route       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx on public.rate_limit_hits (ip, route, created_at);
alter table public.rate_limit_hits enable row level security;

-- 4) Force PostgREST à relire le schéma (l'erreur « schema cache ») ----------
notify pgrst, 'reload schema';

-- =============================================================================
--  VÉRIFICATION — doit renvoyer 8 lignes
-- =============================================================================
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'candidatures'     and column_name in ('consent_at','created_at','roster'))
    or (table_name = 'support_messages' and column_name in ('consent_at','created_at'))
    or (table_name = 'rate_limit_hits'  and column_name in ('ip','route','created_at'))
  )
order by table_name, column_name;
