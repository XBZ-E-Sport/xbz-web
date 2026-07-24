-- Renomme `candidatures.rang` → `candidatures.roster`.
-- La colonne stocke le ROSTER souhaité par le candidat (sélecteur du formulaire
-- de recrutement), pas un « rang ». À NE PAS confondre avec `joueurs.rang`,
-- qui est le vrai rang d'un joueur (ex. « Supersonic Legend ») et reste inchangé.
--
-- Idempotent : ne fait rien si la colonne est déjà renommée.
--
-- ⚠️ À exécuter AVANT de déployer le code qui écrit dans `roster`.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidatures' and column_name = 'rang'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidatures' and column_name = 'roster'
  ) then
    alter table public.candidatures rename column rang to roster;
  end if;
end $$;
