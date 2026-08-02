-- ============================================================
--  MIGRATION /equipes — revue (points 2 & 5)
--  À exécuter dans Supabase → SQL Editor, après les migrations
--  précédentes. Idempotent.
-- ============================================================

-- POINT 2 — Texte du badge découplé du style (variant) --------
--   `variant` ne pilote plus que la COULEUR ; `badge` (optionnel)
--   donne le TEXTE. Vide → texte auto dérivé du variant côté app.
alter table public.poles add column if not exists badge text;

-- POINT 5 — Appartenance exclusive roster XOR pôle -----------
--   Un joueur/membre appartient à un roster OU un pôle, jamais
--   aux deux, jamais à aucun. On passe les FK en CASCADE : si un
--   roster/pôle est supprimé, ses membres le sont aussi (sinon
--   `set null` créerait des orphelins qui violeraient la contrainte).

-- 1) Nettoyage d'éventuels orphelins existants (roster_id ET pole_id nuls).
delete from public.joueurs where roster_id is null and pole_id is null;

-- 2) FK roster_id → CASCADE.
alter table public.joueurs drop constraint if exists joueurs_roster_id_fkey;
alter table public.joueurs
  add constraint joueurs_roster_id_fkey
  foreign key (roster_id) references public.rosters(id) on delete cascade;

-- 3) FK pole_id → CASCADE.
alter table public.joueurs drop constraint if exists joueurs_pole_id_fkey;
alter table public.joueurs
  add constraint joueurs_pole_id_fkey
  foreign key (pole_id) references public.poles(id) on delete cascade;

-- 4) Contrainte XOR : exactement un parent renseigné.
alter table public.joueurs drop constraint if exists joueurs_roster_xor_pole;
alter table public.joueurs
  add constraint joueurs_roster_xor_pole
  check ((roster_id is null) <> (pole_id is null));
