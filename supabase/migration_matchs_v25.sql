-- ============================================================
--  XBZ Esport — Calendrier & résultats des matchs (v2.5)
--  À exécuter dans Supabase → SQL Editor.
--
--  Objectif : afficher les prochains matchs et les résultats de la structure,
--  rattachés à un roster XBZ. Lecture publique des matchs actifs (RLS
--  active = true) ; écriture réservée au back-office (service_role / staff).
--
--  L'heure est une heure MURALE (heure française) : on la stocke telle quelle
--  (`timestamp` SANS fuseau) et on la réaffiche à l'identique, sans conversion —
--  le club et son public sont dans le même fuseau, donc pas de dérive possible.
--
--  Le logo d'un adversaire (facultatif) va dans le bucket Storage public
--  "matchs" (à créer : Supabase → Storage → New bucket → "matchs", public).
-- ============================================================

-- 1) TABLE ----------------------------------------------------

create table if not exists public.matchs (
  id              uuid primary key default gen_random_uuid(),

  -- Équipe XBZ qui joue (roster). `on delete set null` : si le roster est
  -- supprimé, le match reste (résultat conservé) et s'affiche sous « XBZ ».
  roster_id       uuid references public.rosters(id) on delete set null,

  -- Adversaire : nom (obligatoire) + logo facultatif.
  opponent        text not null,
  opponent_logo   text,

  -- Compétition / tournoi (ex. « RLCS », « Coupe de France »).
  competition     text not null default '',

  -- Format : BO1 / BO3 / BO5 / BO7.
  format          text not null default 'BO3',

  -- Date + heure murale (heure française). Voir l'en-tête : pas de fuseau.
  starts_at       timestamp not null,

  -- Cycle de vie : scheduled (à venir) / finished (terminé) / cancelled (annulé).
  status          text not null default 'scheduled',

  -- Scores (renseignés quand le match est terminé). Le résultat (V/D/N) en est
  -- dérivé côté site, jamais stocké.
  score_xbz       int,
  score_opponent  int,

  -- Lien stream / VOD (facultatif).
  stream_url      text,

  active          boolean not null default true,   -- false = masqué (brouillon)
  created_at      timestamptz not null default now()
);

create index if not exists matchs_starts_at_idx on public.matchs (starts_at);
create index if not exists matchs_status_idx on public.matchs (status);
create index if not exists matchs_active_idx on public.matchs (active);
create index if not exists matchs_roster_idx on public.matchs (roster_id);

-- 2) RLS : lecture publique des matchs actifs ---------------
alter table public.matchs enable row level security;

drop policy if exists "matchs_public_read" on public.matchs;
create policy "matchs_public_read" on public.matchs
  for select using (active = true);
-- (Pas de policy d'écriture → seules les requêtes service_role/back-office écrivent.)

-- 3) SEED (exemples — à adapter ou supprimer) ---------------
insert into public.matchs (opponent, competition, format, starts_at, status)
values
  ('Équipe adverse', 'Match amical', 'BO3', (current_date + interval '7 days' + interval '18 hours')::timestamp, 'scheduled'),
  ('Ancien adversaire', 'Tournoi régional', 'BO5', (current_date - interval '7 days' + interval '20 hours')::timestamp, 'finished')
on conflict do nothing;

-- Renseigne un score sur l'exemple terminé (résultat = victoire 3-1).
update public.matchs
  set score_xbz = 3, score_opponent = 1
  where status = 'finished' and competition = 'Tournoi régional' and score_xbz is null;
