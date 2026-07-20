-- ============================================================
--  XBZ Esport — Rosters & Joueurs
--  À exécuter dans Supabase → SQL Editor.
--  Lecture publique (le site public affiche ces données) ;
--  écriture réservée au back-office (service_role / staff).
-- ============================================================

-- 1) TABLES ---------------------------------------------------

create table if not exists public.rosters (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- ex: "ssl", "gc3"
  name        text not null,                 -- ex: "Roster SSL"
  rank        text,                          -- ex: "Supersonic Legend"
  description text,
  position    int not null default 0,        -- ordre d'affichage
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.joueurs (
  id          uuid primary key default gen_random_uuid(),
  roster_id   uuid references public.rosters(id) on delete set null,
  slug        text not null unique,          -- ex: "nass" → /equipes/ssl/nass
  pseudo      text not null,                 -- ex: "NASS"
  nom         text,                          -- vrai nom, ex: "Nassim Bali"
  photo_url   text,                          -- URL (Supabase Storage, CDN, Discord…)
  pays        text,                          -- ex: "France"
  pays_code   text,                          -- ISO alpha-2, ex: "FR" (pour le drapeau)
  role        text not null default 'Joueur',-- Capitaine / Joueur / Coach / Sub / Manager
  bio         text,
  rang        text,                          -- ex: "Supersonic Legend"
  mmr         int,
  twitter     text,                          -- URL ou handle
  twitch      text,
  rltracker   text,
  palmares    text[] not null default '{}',  -- liste de succès
  position    int not null default 0,        -- ordre dans le roster
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists joueurs_roster_id_idx on public.joueurs (roster_id);

-- 2) RLS : lecture publique uniquement -----------------------

alter table public.rosters enable row level security;
alter table public.joueurs enable row level security;

drop policy if exists "rosters_public_read" on public.rosters;
create policy "rosters_public_read" on public.rosters
  for select using (active = true);

drop policy if exists "joueurs_public_read" on public.joueurs;
create policy "joueurs_public_read" on public.joueurs
  for select using (active = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)

-- 3) SEED des rosters (repris de l'effectif actuel) ----------

insert into public.rosters (slug, name, rank, description, position) values
  ('ssl', 'Roster SSL', 'Supersonic Legend', 'L''équipe la plus élite de la structure.', 1),
  ('gc3', 'Roster GC3', 'Grand Champion III', 'Équipe compétitive haut niveau.',        2),
  ('gc2', 'Roster GC2', 'Grand Champion II',  'Équipe compétitive.',                     3),
  ('gc1', 'Roster GC1', 'Grand Champion I',   'Équipe compétitive.',                     4),
  ('c3',  'Roster C3',  'Champion III',       'Équipe en développement.',                5)
on conflict (slug) do nothing;

-- 4) SEED d'exemple de joueurs (⚠️ REMPLACE par tes vrais joueurs) --

insert into public.joueurs
  (roster_id, slug, pseudo, nom, pays, pays_code, role, rang, bio, twitter, twitch, rltracker, palmares, position)
select r.id, v.slug, v.pseudo, v.nom, v.pays, v.pays_code, v.role, v.rang, v.bio,
       v.twitter, v.twitch, v.rltracker, v.palmares, v.position
from public.rosters r
join (values
  ('ssl','exemple-1','EXEMPLE1','Prénom Nom','France','FR','Capitaine','Supersonic Legend',
     'Joueur d''exemple — à remplacer dans le back-office.',
     'https://x.com/xbzesport','https://twitch.tv/xbzesport','https://rocketleague.tracker.network/',
     array['Vainqueur Coupe de France 2025'], 1),
  ('ssl','exemple-2','EXEMPLE2','Prénom Nom','France','FR','Joueur','Supersonic Legend',
     'Joueur d''exemple — à remplacer.', null, null, null, array[]::text[], 2),
  ('ssl','exemple-3','EXEMPLE3','Prénom Nom','Belgique','BE','Joueur','Grand Champion III',
     'Joueur d''exemple — à remplacer.', null, null, null, array[]::text[], 3)
) as v(roster_slug, slug, pseudo, nom, pays, pays_code, role, rang, bio, twitter, twitch, rltracker, palmares, position)
  on v.roster_slug = r.slug
on conflict (slug) do nothing;
