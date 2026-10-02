-- ============================================================
--  XBZ Esport — Pages produit (photos supplémentaires, guide des tailles)
--  À exécuter dans Supabase → SQL Editor, AVANT de déployer le code.
--  Rejouable sans risque (if not exists, contraintes recréées).
--
--  Le site reste fonctionnel si le code arrive avant la migration :
--  la lecture du catalogue retombe sur les colonnes existantes
--  (src/lib/boutique.ts) — seules les photos supplémentaires et le
--  guide des tailles manquent, et le back-office refuse de les enregistrer.
-- ============================================================

-- Photos supplémentaires, dans l'ordre d'affichage, APRÈS la photo principale
-- (`image`). Des URL Supabase Storage (bucket public `products`).
alter table public.products add column if not exists images text[] not null default '{}';

-- Guide des tailles (texte libre : mesures, conseils de coupe), FR et EN.
-- Vide → la page produit n'affiche pas de section « Guide des tailles ».
alter table public.products add column if not exists size_guide    text;
alter table public.products add column if not exists size_guide_en text;

-- Garde-fous : 8 photos supplémentaires au plus, guide de taille raisonnable.
alter table public.products drop constraint if exists products_images_max;
alter table public.products add constraint products_images_max
  check (coalesce(array_length(images, 1), 0) <= 8);

alter table public.products drop constraint if exists products_size_guide_len;
alter table public.products add constraint products_size_guide_len
  check (char_length(coalesce(size_guide, '')) <= 4000 and char_length(coalesce(size_guide_en, '')) <= 4000);

-- (Lecture publique et écriture back-office : inchangées — les politiques de
-- `products` s'appliquent aux nouvelles colonnes.)
