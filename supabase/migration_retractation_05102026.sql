-- ============================================================
--  XBZ Esport — Rétractation en ligne (fonction « Renoncer au contrat ici »)
--  À exécuter dans Supabase → SQL Editor, AVANT de déployer le code qui
--  l'utilise. Rejouable sans risque.
--
--  Depuis le 19 juin 2026, un site qui vend à des consommateurs doit offrir une
--  fonction de rétractation en ligne : le client déclare, confirme, et reçoit un
--  accusé de réception (contenu de la déclaration, date et heure) sur support
--  durable. Chaque déclaration est gardée ici : c'est la preuve, pour le client
--  comme pour l'association.
--
--  Données PRIVÉES (nom, e-mail) : RLS sans aucune policy, seul le serveur
--  (clé service_role) lit et écrit — comme `orders`.
-- ============================================================

create table if not exists public.order_withdrawals (
  id             uuid primary key default gen_random_uuid(),
  -- Commande rapprochée (null si elle n'a pas pu être identifiée : le staff
  -- tranche à la main). `on delete set null` : la déclaration survit à la commande.
  order_id       uuid references public.orders(id) on delete set null,
  -- Numéro de commande tel que le client l'a saisi (normalisé), s'il l'a donné.
  order_number   text,
  -- Comment la commande a été rapprochée :
  --   exact     : numéro de commande reconnu ;
  --   single    : une seule commande payée pour cet e-mail ;
  --   ambiguous : plusieurs commandes payées pour cet e-mail ;
  --   none      : aucune commande payée pour cet e-mail.
  match          text not null default 'none'
                 check (match in ('exact', 'single', 'ambiguous', 'none')),
  customer_name  text not null,
  customer_email text not null,
  -- Précisions libres du client (articles concernés si rétractation partielle).
  details        text,
  locale         text not null default 'fr',
  -- Date et heure de la déclaration : horodatage SERVEUR, jamais celui du navigateur.
  received_at    timestamptz not null default now(),
  -- Accusé de réception envoyé par e-mail ; en cas d'échec, `ack_error` dit pourquoi
  -- et le cron quotidien réessaie (5 essais au plus).
  ack_sent_at    timestamptz,
  ack_attempts   integer not null default 0,
  ack_error      text,
  -- Renseigné par le staff quand le retour et le remboursement sont traités.
  processed_at   timestamptz
);

create index if not exists order_withdrawals_order_idx on public.order_withdrawals (order_id);
create index if not exists order_withdrawals_received_idx on public.order_withdrawals (received_at desc);
-- Accusés à (re)envoyer : l'index ne contient que les lignes concernées.
create index if not exists order_withdrawals_ack_pending_idx
  on public.order_withdrawals (received_at)
  where ack_sent_at is null;

alter table public.order_withdrawals enable row level security;
-- (Volontairement AUCUNE policy : même un SELECT anonyme est refusé.)

-- Conservation : comme les commandes (pièces comptables, 10 ans), aucune purge
-- automatique. Voir la politique de confidentialité.
