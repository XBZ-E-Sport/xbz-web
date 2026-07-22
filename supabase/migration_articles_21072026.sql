-- ============================================================
--  MIGRATION Actualité → BDD
--  Table `articles` (lecture publique des articles publiés,
--  écriture réservée au back-office via service_role).
--  À exécuter dans Supabase → SQL Editor.
-- ============================================================

create table if not exists public.articles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text not null default '',
  content     text[] not null default '{}',          -- paragraphes
  category    text not null default 'Annonce',        -- Compétition | Recrutement | Annonce | Communauté | Création
  author      text not null default 'Staff XBZ',
  date        date not null default current_date,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists articles_date_idx on public.articles (date desc);

alter table public.articles enable row level security;
drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read" on public.articles
  for select using (published = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)

-- Seed : reprise des articles actuellement en dur (dollar-quoting → apostrophes OK).
insert into public.articles (slug, title, excerpt, content, category, author, date) values
(
  'recrutement-rocket-league-ouvert',
  $$Le recrutement Rocket League est ouvert$$,
  $$XBZ ouvre plusieurs places dans ses rosters compétitifs et son staff. Postule dès maintenant.$$,
  array[
    $$La structure XBZ recherche de nouveaux talents pour renforcer ses équipes Rocket League. Plusieurs postes sont ouverts, du Champion au Supersonic Legend.$$,
    $$Le recrutement concerne aussi le staff et la création de contenu : managers, coachs, monteurs et graphistes sont les bienvenus.$$,
    $$Pour postuler, rends-toi sur la page recrutement et remplis le formulaire. Le staff étudie chaque candidature avec attention.$$
  ],
  'Recrutement', 'Staff XBZ', '2026-07-14'
),
(
  'rosters-preparation-nouvelle-saison',
  $$Nos rosters se préparent pour la nouvelle saison$$,
  $$Entraînements intensifs et nouveaux objectifs : les équipes XBZ montent en régime avant la reprise.$$,
  array[
    $$À l'approche de la nouvelle saison, les rosters XBZ intensifient les entraînements et peaufinent leurs stratégies.$$,
    $$L'objectif est clair : gagner en régularité et viser le haut du classement dans chaque division.$$,
    $$Suis les résultats et les temps forts directement sur notre Discord.$$
  ],
  'Compétition', 'Staff XBZ', '2026-07-05'
),
(
  'pole-creation-sagrandit',
  $$Le pôle création s'agrandit$$,
  $$Graphistes, monteurs et casters : le pôle contenu de XBZ recrute pour faire rayonner le club.$$,
  array[
    $$Le contenu est au cœur de l'identité de XBZ. Pour aller plus loin, le pôle création s'ouvre à de nouveaux profils.$$,
    $$Montage de clips, visuels, casting de matchs : chaque compétence a sa place pour mettre en valeur les équipes.$$
  ],
  'Création', 'Staff XBZ', '2026-06-24'
),
(
  'xbz-lance-nouveau-site',
  $$XBZ lance son nouveau site$$,
  $$Nouvelle identité, nouvelles pages : découvre le site XBZ v2, pensé pour la communauté.$$,
  array[
    $$XBZ franchit une étape avec un tout nouveau site : plus clair, plus rapide et pensé pour la communauté.$$,
    $$Au programme : présentation du club, équipes, recrutement, et bientôt une boutique et un espace actualité alimenté en direct.$$,
    $$Ce n'est que le début : le site continuera d'évoluer au fil des saisons.$$
  ],
  'Annonce', 'Staff XBZ', '2026-06-12'
)
on conflict (slug) do nothing;
