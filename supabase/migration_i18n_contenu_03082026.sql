-- ============================================================
--  XBZ Esport — Traduction anglaise du contenu de la base
--  À exécuter dans Supabase → SQL Editor.
--
--  Principe : chaque champ traduisible garde sa colonne d'origine (français)
--  et reçoit une colonne jumelle `_en`. Rien n'est déplacé, rien n'est réécrit,
--  aucune donnée existante n'est touchée.
--
--  Les colonnes `_en` sont NULLABLES et vides au départ : le site retombe sur
--  le français tant qu'elles ne sont pas remplies. On peut donc passer cette
--  migration en production sans rien préparer, et traduire ensuite, au rythme
--  qu'on veut, depuis le back-office.
--
--  Migration ré-exécutable sans risque (`add column if not exists`).
-- ============================================================

-- 1) Actualités ----------------------------------------------
-- `author` n'est pas traduit (nom de personne), `date` ni `category` non plus
-- (la catégorie est un enum fermé, traduit côté site).
alter table public.articles
  add column if not exists title_en   text,
  add column if not exists excerpt_en text,
  add column if not exists content_en text[];

-- 2) Boutique ------------------------------------------------
-- `name` est traduit : « Tapis de souris » n'est pas un nom propre.
alter table public.products
  add column if not exists name_en        text,
  add column if not exists description_en text;

-- 3) Rosters -------------------------------------------------
-- `name` (« Roster SSL ») et `rank` (« Supersonic Legend », terme du jeu)
-- restent tels quels dans les deux langues.
alter table public.rosters
  add column if not exists description_en text;

-- 4) Pôles ---------------------------------------------------
-- `name` EST traduit ici : « Modérateurs » → « Moderators ».
alter table public.poles
  add column if not exists name_en        text,
  add column if not exists description_en text,
  add column if not exists badge_en       text;

-- 5) Joueurs / membres ---------------------------------------
-- `pseudo` et `nom` sont des noms propres. `pays` n'a PAS de colonne `_en` :
-- le site dérive le nom du pays depuis `pays_code` (ISO) via `Intl`, dans
-- n'importe quelle langue et sans aucune saisie.
-- `role` non plus : c'est une liste fermée, traduite côté site.
alter table public.joueurs
  add column if not exists bio_en      text,
  add column if not exists palmares_en text[];

-- 6) Vérification --------------------------------------------
-- Doit renvoyer 11 lignes.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name like '%\_en'
order by table_name, column_name;
