-- ============================================================
--  XBZ Esport — Export comptable des commandes : montant remboursé
--  À exécuter dans Supabase → SQL Editor. Rejouable sans risque.
--
--  Jusqu'ici un remboursement partiel n'était noté que dans un texte
--  (`note`) : impossible à exporter proprement. La colonne ci-dessous garde
--  le montant remboursé, total ou partiel, écrit par le webhook Stripe
--  (`charge.refunded`).
--
--  Le code fonctionne AVANT cette migration : le webhook enregistre alors le
--  remboursement sans le montant, et l'export en déduit « tout » pour une
--  commande remboursée en totalité, « rien » pour un partiel.
-- ============================================================

alter table public.orders
  add column if not exists refunded_amount numeric(10,2)
  check (refunded_amount is null or refunded_amount >= 0);

-- Commandes déjà remboursées en totalité : le montant remboursé est tout ce
-- qui a été encaissé.
update public.orders
set refunded_amount = amount_total
where status = 'refunded' and refunded_amount is null and amount_total is not null;
