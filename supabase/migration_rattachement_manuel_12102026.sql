-- Rétractations : rattachement MANUEL d'une déclaration à sa commande.
--
-- Jusqu'ici, une déclaration rattachée à la main par le staff était enregistrée comme
-- « exact » et affichée « Rapprochée : numéro de commande reconnu. », comme si le client
-- avait lui-même saisi un numéro correspondant à son e-mail. Elle porte désormais
-- `match = 'manual'` : le back-office dit qu'elle a été rattachée à la main, et rappelle
-- de vérifier l'e-mail.
--
-- Idempotent : rejouable sans risque. Sans cette migration, le code retombe sur « exact »
-- (comportement d'avant).

alter table public.order_withdrawals drop constraint if exists order_withdrawals_match_check;
alter table public.order_withdrawals add constraint order_withdrawals_match_check
  check (match in ('exact', 'single', 'ambiguous', 'mismatch', 'none', 'manual'));
