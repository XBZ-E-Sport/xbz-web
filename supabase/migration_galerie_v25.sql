-- ============================================================
--  XBZ Esport — Galerie médias (v2.5)
--  À exécuter dans Supabase → SQL Editor.
--
--  Objectif : une galerie de photos et de vidéos du club, filtrable par
--  catégorie. Lecture publique des médias actifs (RLS active = true) ; écriture
--  réservée au back-office (service_role / staff).
--
--  Deux types via `type` : 'photo' (image affichée en grand au clic) et 'video'
--  (vignette qui OUVRE la source YouTube/Twitch — aucune iframe tierce, la CSP
--  stricte du site reste inchangée). Les images (photos + vignettes) vont dans
--  le bucket Storage public "medias" (à créer : Supabase → Storage → New bucket
--  → "medias", public).
--
--  `category` est une clé stable ASCII (events / matches / creation / backstage),
--  traduite à l'affichage — le visiteur voit « Événements », « Events »…
-- ============================================================

-- 1) TABLE ----------------------------------------------------

create table if not exists public.medias (
  id          uuid primary key default gen_random_uuid(),

  -- 'photo' ou 'video'.
  type        text not null default 'photo',

  -- Titre / légende (facultatif).
  title       text not null default '',

  -- Catégorie (clé stable) : events / matches / creation / backstage.
  category    text not null default 'events',

  -- Image : la photo elle-même, ou la vignette d'une vidéo (bucket "medias").
  image       text,

  -- Lien de la vidéo (YouTube/Twitch) pour type = 'video'. Ouvre la source.
  video_url   text,

  active      boolean not null default true,   -- false = masqué (brouillon)
  position    int not null default 0,          -- ordre d'affichage
  created_at  timestamptz not null default now()
);

create index if not exists medias_position_idx on public.medias (position);
create index if not exists medias_active_idx on public.medias (active);
create index if not exists medias_category_idx on public.medias (category);

-- 2) RLS : lecture publique des médias actifs ---------------
alter table public.medias enable row level security;

drop policy if exists "medias_public_read" on public.medias;
create policy "medias_public_read" on public.medias
  for select using (active = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)
