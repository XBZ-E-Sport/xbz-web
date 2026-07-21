-- Correctif : rendre nullables les colonnes facultatives de `candidatures`.
--
-- Contexte : une candidature « XBZ Staff » n'a pas de jeu, et plusieurs champs
-- du formulaire de recrutement sont facultatifs (pays, rang, expérience...).
-- L'API insère donc NULL pour ces colonnes. Si elles sont déclarées NOT NULL,
-- l'insert échoue :
--   null value in column "jeu" of relation "candidatures" violates not-null constraint
--
-- Postgres ne signale qu'une violation à la fois : on relâche donc TOUTES les
-- colonnes facultatives d'un coup pour éviter les erreurs en cascade.
--
-- Idempotent : « DROP NOT NULL » sur une colonne déjà nullable ne fait rien.
-- Les champs réellement obligatoires (categorie, role, nom, age, discord,
-- pseudo) restent inchangés.

alter table public.candidatures alter column jeu             drop not null;
alter table public.candidatures alter column pays_residence  drop not null;
alter table public.candidatures alter column rltracker       drop not null;
alter table public.candidatures alter column rang            drop not null;
alter table public.candidatures alter column experience      drop not null;
alter table public.candidatures alter column motivation      drop not null;
