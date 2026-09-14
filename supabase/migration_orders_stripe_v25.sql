-- ============================================================
--  XBZ Esport — v2.5 : boutique réelle (paiement Stripe)
--  À exécuter dans Supabase → SQL Editor, APRÈS migration_products.
--
--  Modèle « Checkout hébergé + on s'appuie sur Stripe » :
--   - le prix fait autorité côté serveur (colonne `price`), jamais le
--     navigateur ;
--   - Stripe collecte l'adresse de livraison, le port et la TVA ;
--   - une commande n'est écrite QUE sur réception du webhook signé
--     `checkout.session.completed` — jamais sur un simple retour d'URL.
-- ============================================================

-- 1) PRODUITS : `available` devient « achetable sur le site via Stripe ».
--    L'ancien champ `url` (lien d'achat externe) reste en base pour ne rien
--    casser, mais le flux d'achat ne l'utilise plus. Rien à altérer ici : la
--    table products existe déjà, on documente juste le nouveau sens.

-- 2) COMMANDES ------------------------------------------------
--    Données PRIVÉES : aucune lecture publique. Seul le back-office
--    (service_role) lit et écrit — comme candidatures / support_messages.

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),

  -- Identifiants Stripe : `session_id` sert de clé d'idempotence (le webhook
  -- peut arriver plusieurs fois — Stripe réessaie). L'unicité empêche le
  -- double enregistrement d'une même commande.
  stripe_session_id     text not null unique,
  stripe_payment_intent text,

  -- 'pending'   : session créée, paiement pas encore confirmé (rare : on écrit
  --               surtout à 'paid' via le webhook) ;
  -- 'paid'      : paiement confirmé par Stripe ;
  -- 'fulfilled' : commande expédiée (marqué au back-office) ;
  -- 'refunded'  : remboursée.
  status                text not null default 'pending'
                        check (status in ('pending','paid','fulfilled','refunded')),

  -- Montant RÉELLEMENT encaissé par Stripe (articles + port), en euros.
  amount_total          numeric(10,2) not null default 0,
  currency              text not null default 'eur',

  -- Coordonnées client renvoyées par Stripe (le site ne les saisit jamais).
  customer_email        text,
  customer_name         text,
  shipping_address      jsonb,   -- { line1, line2, city, postal_code, country… }

  -- Instantané des articles au moment de l'achat : nom + quantité + prix
  -- unitaire figés. Si un produit change de prix ou disparaît ensuite, la
  -- commande garde une trace fidèle de ce qui a été vendu.
  line_items            jsonb not null default '[]'::jsonb,

  created_at            timestamptz not null default now(),
  paid_at               timestamptz
);

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- 3) RLS : verrouillage total ---------------------------------
--    RLS activée SANS aucune policy → personne ne lit/écrit via la clé
--    publique. Seule la clé service_role (webhook + back-office) contourne la
--    RLS. Une commande contient une adresse et un email : jamais public.
alter table public.orders enable row level security;
-- (Volontairement aucune policy : le service_role passe outre, tout le reste
--  est refusé — même un SELECT anonyme.)

-- 4) Purge RGPD : les commandes rejoignent le balayage existant.
--    Rien à ajouter ici — voir /api/cron/purge (conservation limitée).
