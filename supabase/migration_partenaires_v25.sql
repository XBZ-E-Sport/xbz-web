-- ============================================================
--  XBZ Esport — Partenaires & Sponsors (v2.5)
--  À exécuter dans Supabase → SQL Editor.
--
--  Objectif : afficher les partenaires et sponsors de la structure (mur de
--  logos cliquables) sur une page publique dédiée + un bandeau d'accueil.
--  Lecture publique des entrées actives (RLS `active = true`) ; écriture
--  réservée au back-office (service_role / staff), comme articles / produits.
--
--  Deux groupes via la colonne `type` : 'sponsor' (partenaire financier, mis en
--  avant) et 'partenaire'. La colonne `description_en` porte la traduction
--  anglaise (repli sur le français si vide), même mécanisme que les articles.
--
--  Les logos sont hébergés dans un bucket Storage PUBLIC "partners" (à créer :
--  Supabase → Storage → New bucket → "partners", public). Le back-office y
--  envoie l'image via le même traitement que les visuels produits.
-- ============================================================

-- 1) TABLE ----------------------------------------------------

create table if not exists public.partners (
  id             uuid primary key default gen_random_uuid(),

  -- Nom du partenaire (marque). Sert aussi de texte alternatif du logo — non
  -- traduit : un nom propre reste identique dans les deux langues.
  name           text not null,

  -- Groupe d'affichage : 'sponsor' (mis en avant) ou 'partenaire'.
  type           text not null default 'partenaire',

  -- Rôle / mention courte (ex. « Équipementier officiel »). Facultatif.
  description    text not null default '',
  description_en text,

  -- Logo : URL publique (bucket Storage "partners") ou URL externe.
  logo           text,

  -- Lien vers le site du partenaire (ouvre un nouvel onglet). Facultatif.
  url            text,

  active         boolean not null default true,     -- false = masqué (brouillon)
  position       int not null default 0,            -- ordre d'affichage dans son groupe
  created_at     timestamptz not null default now()
);

create index if not exists partners_position_idx on public.partners (position);
create index if not exists partners_active_idx on public.partners (active);
create index if not exists partners_type_idx on public.partners (type);

-- 2) RLS : lecture publique des entrées actives -------------
alter table public.partners enable row level security;

drop policy if exists "partners_public_read" on public.partners;
create policy "partners_public_read" on public.partners
  for select using (active = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)

-- 3) SEED (exemples — à adapter ou supprimer) ---------------
insert into public.partners (name, type, description, position)
values
  ('Sponsor principal', 'sponsor', 'Partenaire officiel de la structure.', 1),
  ('Partenaire média', 'partenaire', 'Couverture des compétitions.', 1)
on conflict do nothing;
