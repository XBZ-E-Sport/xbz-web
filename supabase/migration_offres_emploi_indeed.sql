-- ============================================================
--  XBZ Esport — Offres d'emploi (« Carrières »), crawlables par Indeed
--  À exécuter dans Supabase → SQL Editor.
--
--  Objectif : exposer des offres d'emploi PUBLIQUES, à URL stable, avec une
--  description lisible en HTML — pour qu'Indeed et Google for Jobs les
--  récupèrent via les données structurées `JobPosting` (posées sur la page de
--  détail). Lecture publique des offres actives (RLS `active = true`) ;
--  écriture réservée au back-office (service_role / staff), comme articles /
--  produits.
--
--  Les colonnes `_en` portent la traduction anglaise (repli sur le français si
--  vide) — même mécanisme que les articles.
-- ============================================================

-- 1) TABLE ----------------------------------------------------

create table if not exists public.job_offers (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,              -- ex: "developpeur-web"

  -- Intitulé de poste (JobPosting.title, REQUIS par Indeed).
  title           text not null,
  title_en        text,

  -- Résumé court : carte de liste + meta description.
  excerpt         text not null default '',
  excerpt_en      text,

  -- Description complète, un paragraphe par élément (JobPosting.description,
  -- REQUIS). Rendue en HTML dans la page et dans le JSON-LD.
  description     text[] not null default '{}',
  description_en  text[] not null default '{}',

  -- Service / pôle concerné (affichage + filtre). Ex: "Développement".
  department      text not null default '',
  department_en   text,

  -- Type de contrat au format schema.org (JobPosting.employmentType) :
  -- FULL_TIME, PART_TIME, CONTRACTOR, TEMPORARY, INTERN, VOLUNTEER.
  employment_type text not null default 'FULL_TIME',

  -- Localisation. `remote = true` → télétravail (JobPosting.jobLocationType
  -- TELECOMMUTE). Sinon, une adresse est requise pour qu'Indeed valide l'offre.
  remote          boolean not null default false,
  city            text,
  region          text,
  postal_code     text,
  country         text not null default 'FR',        -- code ISO 3166-1 alpha-2

  -- Rémunération (facultatif mais recommandé par Indeed). Bornes en euros,
  -- période au format schema.org : HOUR / MONTH / YEAR.
  salary_min      numeric(10,2),
  salary_max      numeric(10,2),
  salary_period   text not null default 'MONTH',

  -- Dates : `date_posted` (JobPosting.datePosted, REQUIS) et `valid_through`
  -- (fin de validité, recommandé — au-delà l'offre devrait être désactivée).
  date_posted     date not null default current_date,
  valid_through   date,

  -- Où postuler : lien externe (ATS, mailto:, formulaire). Vide → la page
  -- renvoie vers le formulaire de recrutement du site.
  apply_url       text,

  active          boolean not null default true,     -- false = hors ligne (brouillon)
  position        int not null default 0,            -- ordre d'affichage
  created_at      timestamptz not null default now()
);

create index if not exists job_offers_position_idx on public.job_offers (position);
create index if not exists job_offers_active_idx on public.job_offers (active);

-- 2) RLS : lecture publique des offres actives --------------
--    Indispensable : Indeed doit consulter les offres SANS connexion.
alter table public.job_offers enable row level security;

drop policy if exists "job_offers_public_read" on public.job_offers;
create policy "job_offers_public_read" on public.job_offers
  for select using (active = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)

-- 3) SEED (exemple — à adapter ou supprimer) ----------------
insert into public.job_offers
  (slug, title, excerpt, description, department, employment_type, remote, city, region, postal_code, valid_through, position)
values
  (
    'developpeur-web',
    'Développeur web (H/F)',
    'Rejoins XBZ pour construire et faire évoluer notre présence en ligne.',
    array[
      'XBZ Esport recherche un développeur web pour maintenir et faire évoluer son site et ses outils internes.',
      'Stack : Next.js, TypeScript, Supabase. Missions : nouvelles fonctionnalités, performance, qualité.',
      'Profil : autonomie, rigueur, goût du travail en équipe.'
    ],
    'Développement',
    'FULL_TIME',
    true,
    null, null, null,
    (current_date + interval '60 days')::date,
    1
  )
on conflict (slug) do nothing;
