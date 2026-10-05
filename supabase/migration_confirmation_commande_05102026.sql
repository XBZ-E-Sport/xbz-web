-- ============================================================
--  XBZ Esport — E-mail de confirmation de commande
--  À exécuter dans Supabase → SQL Editor, de préférence AVANT de déployer le code qui
--  l'utilise. Rejouable sans risque. Le code fonctionne aussi sans elle : la confirmation
--  part alors une seule fois, sans suivi ni reprise.
--
--  Après chaque paiement, le site envoie au client un e-mail qui confirme son contrat
--  (ce qu'il a commandé, texte imprimé compris, montants, délai de livraison, droit de
--  rétractation et exclusion pour les articles personnalisés, garanties légales), en plus
--  du reçu de Stripe. Ces deux colonnes en gardent la trace :
--    confirmation_sent_at : date d'envoi (vide = pas encore partie) ;
--    confirmation_error   : dernière erreur du fournisseur d'e-mails (sans adresse ni texte).
--  Le cron quotidien renvoie les confirmations dont le premier envoi a échoué.
-- ============================================================

alter table public.orders add column if not exists confirmation_sent_at timestamptz;
alter table public.orders add column if not exists confirmation_error text;

-- Confirmations à reprendre : l'index ne contient que les lignes concernées.
create index if not exists orders_confirmation_pending_idx
  on public.orders (paid_at)
  where confirmation_sent_at is null and confirmation_error is not null;
