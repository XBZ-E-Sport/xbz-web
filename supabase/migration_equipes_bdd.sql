-- ============================================================
--  MIGRATION /equipes → 100 % BDD
--  Slots dynamiques (rempli = nb de membres réels, total = capacity).
--  À exécuter dans Supabase → SQL Editor (après rosters_joueurs.sql).
-- ============================================================

-- 1) rosters : capacité + rôle recruté ----------------------
alter table public.rosters add column if not exists capacity int not null default 3;
alter table public.rosters add column if not exists recrute text default 'Joueur';

-- 2) poles : groupes staff (et staff-esport) ----------------
create table if not exists public.poles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  category    text not null default 'staff',   -- 'staff' | 'esport'
  capacity    int not null default 1,           -- total de places
  recrute     text,                             -- rôle recrutement alimenté (null = pas de recrutement)
  fixed       boolean not null default false,   -- true = jamais au recrutement (Fondateurs…)
  variant     text not null default 'staff',    -- founder | staff | member | creative (couleur badge)
  position    int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.poles enable row level security;
drop policy if exists "poles_public_read" on public.poles;
create policy "poles_public_read" on public.poles for select using (active = true);

-- 3) joueurs : peut appartenir à un roster OU un pôle -------
alter table public.joueurs add column if not exists pole_id uuid references public.poles(id) on delete set null;
create index if not exists joueurs_pole_id_idx on public.joueurs (pole_id);

-- 4) seed des pôles (repris de l'ancien contenu en dur) -----
insert into public.poles (slug, name, description, category, capacity, recrute, fixed, variant, position) values
  ('fondateurs',         '👑 Fondateurs',         'Direction de la structure',            'staff',  3, null,                 true,  'founder',  1),
  ('admins',             '🛠️ Admins',             'Gestion serveur & staff',              'staff',  3, null,                 true,  'staff',    2),
  ('moderateurs',        '🛡️ Modérateurs',        'Gestion Discord & communauté',         'staff',  4, 'Modérateur',         false, 'staff',    3),
  ('developpeurs',       '☕ Développeurs',        'Développement web & bot Discord',      'staff',  2, 'Développeur',        false, 'creative', 4),
  ('community-managers', '📢 Community Managers',  'Réseaux sociaux & animation',          'staff',  3, 'Community Manager',  false, 'staff',    5),
  ('casters',            '🎙️ Casters',            'Commentaire & animation de matchs',    'staff',  2, 'Caster',             false, 'creative', 6),
  ('monteurs',           '🎬 Monteurs',           'Montage clips & contenu',              'staff',  2, 'Monteur',            false, 'creative', 7),
  ('graphistes',         '🎨 Graphistes',         'Création visuelle & branding',         'staff',  2, 'Graphiste',          false, 'creative', 8),
  ('gerant-rl',          '⚙️ Gérant RL',          'Direction de la section Rocket League', 'esport', 1, null,                 true,  'staff',    1),
  ('recruteurs',         '💼 Recruteurs',         'Détection & recrutement de talents',   'esport', 2, 'Recruteur',          false, 'staff',    2),
  ('managers',           '👨🏻‍💼 Managers',         'Gestion des équipes compétitives',     'esport', 5, 'Manager',            false, 'staff',    3),
  ('coachs',             '💪 Coachs',             'Encadrement & stratégie de jeu',       'esport', 3, 'Coach',              false, 'staff',    4)
on conflict (slug) do nothing;

-- Note : le « rempli » de chaque roster/pôle = nombre de membres (joueurs)
-- réellement en base. Les compteurs partent donc de 0 tant que le staff n'a
-- pas ajouté les vrais membres via le back-office (/admin/rosters, /admin/poles).
