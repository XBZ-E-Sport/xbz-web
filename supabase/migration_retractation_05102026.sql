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
  -- Ce que le client a tapé dans « Numéro de commande », TEL QUEL (c'est une part du
  -- contenu de sa déclaration, rappelée dans l'accusé), même si ce n'est pas un numéro.
  order_number   text,
  -- Comment la commande a été rapprochée :
  --   exact     : numéro de commande reconnu ;
  --   single    : aucun numéro saisi et une seule commande payée pour cet e-mail ;
  --   ambiguous : aucun numéro saisi et plusieurs commandes payées pour cet e-mail ;
  --   mismatch  : un numéro a été saisi mais ne correspond à aucune commande payée
  --               de cet e-mail (on ne devine pas : le staff vérifie) ;
  --   none      : aucune commande payée pour cet e-mail.
  match          text not null default 'none'
                 check (match in ('exact', 'single', 'ambiguous', 'mismatch', 'none')),
  customer_name  text not null,
  customer_email text not null,
  -- Précisions libres du client (articles concernés si rétractation partielle).
  details        text,
  locale         text not null default 'fr',
  -- Boîte aux lettres normalisée (casse, « +tag », points de Gmail) : sert UNIQUEMENT à
  -- plafonner les accusés par destinataire ; l'accusé part à l'adresse saisie.
  mailbox_key    text,
  -- Piège anti-bot rempli : déclaration gardée mais accusé automatique suspendu (un
  -- gestionnaire de mots de passe peut remplir le champ caché d'un vrai client : on ne
  -- jette JAMAIS une déclaration). Le staff vérifie, puis renvoie l'accusé à la main.
  suspect        boolean not null default false,
  -- Date et heure de la déclaration : horodatage SERVEUR, jamais celui du navigateur.
  received_at    timestamptz not null default now(),
  -- Accusé de réception envoyé par e-mail ; en cas d'échec, `ack_error` dit pourquoi
  -- et le cron quotidien réessaie (5 essais au plus).
  ack_sent_at    timestamptz,
  ack_attempts   integer not null default 0,
  ack_error      text,
  -- Verrou d'envoi : posé juste avant d'appeler le fournisseur d'e-mails pour que le cron
  -- et la route ne postent pas deux fois le même accusé.
  ack_hold_until timestamptz,
  -- Renseigné par le staff quand le retour et le remboursement sont traités.
  processed_at   timestamptz
);

-- Rejouable sur une table déjà créée par la première version de ce fichier.
alter table public.order_withdrawals add column if not exists mailbox_key text;
alter table public.order_withdrawals add column if not exists suspect boolean not null default false;
alter table public.order_withdrawals add column if not exists ack_hold_until timestamptz;
alter table public.order_withdrawals drop constraint if exists order_withdrawals_match_check;
alter table public.order_withdrawals add constraint order_withdrawals_match_check
  check (match in ('exact', 'single', 'ambiguous', 'mismatch', 'none'));

create index if not exists order_withdrawals_order_idx on public.order_withdrawals (order_id);
create index if not exists order_withdrawals_mailbox_idx on public.order_withdrawals (mailbox_key, ack_sent_at);
create index if not exists order_withdrawals_received_idx on public.order_withdrawals (received_at desc);
-- Accusés à (re)envoyer : l'index ne contient que les lignes concernées.
create index if not exists order_withdrawals_ack_pending_idx
  on public.order_withdrawals (received_at)
  where ack_sent_at is null;

alter table public.order_withdrawals enable row level security;
-- (Volontairement AUCUNE policy : même un SELECT anonyme est refusé.)

-- Supabase ne donne plus automatiquement leurs droits aux rôles sur les nouvelles
-- tables : le serveur (clé service_role) doit pouvoir les lire et les écrire.
grant all on public.order_withdrawals to service_role;

-- Conservation : 5 ans (prescription des actions entre consommateur et vendeur), puis
-- suppression par /api/cron/purge ; les déclarations au piège anti-bot rempli sont
-- supprimées au bout de 30 jours. La commande rattachée, elle, reste 10 ans.
-- Voir la politique de confidentialité.
