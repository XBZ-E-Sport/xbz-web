-- ============================================================
--  XBZ Esport — Boutique (produits)
--  À exécuter dans Supabase → SQL Editor.
--  Lecture publique des produits actifs ; écriture réservée au
--  back-office (service_role / staff). Achat via lien externe
--  (champ `url`) — AUCUN paiement géré sur le site.
-- ============================================================

-- 1) TABLE ----------------------------------------------------

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,               -- ex: "maillot-officiel"
  name        text not null,                      -- ex: "Maillot officiel XBZ"
  description text not null default '',
  price       numeric(10,2) not null default 0,   -- prix en euros
  category    text not null default 'Textile',    -- Textile / Accessoire / Gaming
  icon        text not null default '',           -- emoji de repli si pas d'image
  image       text,                               -- URL (Supabase Storage), optionnel
  url         text,                               -- lien d'achat externe (si available)
  available   boolean not null default false,     -- true = achetable (bouton "Acheter")
  position    int not null default 0,             -- ordre d'affichage
  active      boolean not null default true,      -- false = masqué du site (brouillon)
  created_at  timestamptz not null default now()
);

create index if not exists products_position_idx on public.products (position);

-- 2) RLS : lecture publique des produits actifs --------------

alter table public.products enable row level security;

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (active = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)

-- 3) SEED (reprend la collection d'aperçu actuelle) ----------

insert into public.products (slug, name, description, price, category, icon, available, position) values
  ('maillot-officiel', 'Maillot officiel XBZ', 'Le maillot compétitif aux couleurs de la structure.',           49.99, 'Textile',    '👕', false, 1),
  ('hoodie',           'Hoodie XBZ',           'Sweat à capuche premium, logo brodé sur la poitrine.',           59.99, 'Textile',    '🧥', false, 2),
  ('casquette',        'Casquette XBZ',        'Casquette ajustable brodée, finition mate.',                     19.99, 'Accessoire', '🧢', false, 3),
  ('tapis-souris-xl',  'Tapis de souris XL',   'Grand tapis gaming, surface optimisée pour la précision.',       29.99, 'Gaming',     '🖱️', false, 4),
  ('mug',              'Mug XBZ',              'Mug céramique aux couleurs du club pour les sessions du matin.', 14.99, 'Accessoire', '☕', false, 5),
  ('sticker-pack',     'Pack de stickers',     'Lot de stickers XBZ pour customiser ton setup.',                  6.99, 'Accessoire', '🔖', false, 6)
on conflict (slug) do nothing;

-- 4) STORAGE : bucket public pour les visuels produits -------
-- Upload via le back-office (clé service_role, contourne la RLS) ;
-- lecture publique via l'URL du bucket.

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;
