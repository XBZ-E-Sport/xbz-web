-- ============================================================
--  XBZ Esport — Boutique en ligne : tailles, stock, commandes (Stripe)
--  À exécuter dans Supabase → SQL Editor, APRÈS migration_products et
--  migration_i18n_contenu. Rejouable sans casse (idempotent).
--
--  Principes :
--   - le PRIX fait autorité côté base (products.price), jamais le navigateur ;
--   - le stock est RÉSERVÉ au moment où le client part payer (30 min), puis
--     confirmé par le webhook Stripe, ou rendu si le paiement n'aboutit pas.
--     Deux clients ne peuvent donc pas payer la dernière pièce ;
--   - tout ce qui touche au stock passe par les fonctions ci-dessous, en UNE
--     transaction chacune : jamais de stock négatif, jamais de double rendu.
-- ============================================================


-- 1) TAILLES & STOCK -------------------------------------------
--    Une ligne par taille proposée. `size = ''` : taille unique (mug, tapis…).

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  size        text not null default '',
  stock       integer not null default 0 check (stock >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (product_id, size)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, position);

-- Lecture publique des tailles des produits visibles (le site affiche ce qui
-- est en stock). Aucune écriture publique : seul le back-office écrit.
alter table public.product_variants enable row level security;
drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.active)
  );

-- Produits existants : une taille unique à stock 0. Rien n'est donc en vente
-- tant que le staff n'a pas saisi tailles et quantités au back-office.
insert into public.product_variants (product_id, size, stock)
select p.id, '', 0
from public.products p
where not exists (select 1 from public.product_variants v where v.product_id = p.id);


-- 2) COMMANDES -------------------------------------------------
--    Données PRIVÉES (nom, email, adresse) : RLS sans aucune policy, seul le
--    serveur (clé service_role) lit et écrit.
--
--    pending   : stock réservé, client parti payer (jusqu'à `expires_at`) ;
--    paid      : paiement confirmé par le webhook Stripe ;
--    fulfilled : expédiée (back-office) ;
--    cancelled : paiement abandonné ou expiré, stock rendu ;
--    refunded  : remboursée depuis Stripe.

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  status                text not null default 'pending',
  -- Instantané des articles au moment de l'achat (nom, taille, prix figés) :
  -- [{variant_id, product_id, slug, name, size, quantity, unit_amount, image}]
  -- `unit_amount` en centimes, comme chez Stripe.
  items                 jsonb not null default '[]'::jsonb,
  subtotal              numeric(10,2) not null default 0,
  shipping              numeric(10,2) not null default 0,
  currency              text not null default 'eur',
  locale                text not null default 'fr',
  expires_at            timestamptz,
  stripe_session_id     text unique,
  stripe_payment_intent text,
  -- Montant RÉELLEMENT encaissé, relu chez Stripe (articles + port).
  amount_total          numeric(10,2),
  customer_email        text,
  customer_name         text,
  shipping_address      jsonb,
  -- Message pour le staff (ex. paiement arrivé après la fin de la réservation).
  note                  text,
  created_at            timestamptz not null default now(),
  paid_at               timestamptz,
  fulfilled_at          timestamptz,
  cancelled_at          timestamptz,
  refunded_at           timestamptz
);

-- Une première version (branche « stripe », septembre) a pu créer la table
-- avec un autre schéma : on l'amène au schéma ci-dessus sans rien perdre.
alter table public.orders
  add column if not exists items         jsonb not null default '[]'::jsonb,
  add column if not exists subtotal      numeric(10,2) not null default 0,
  add column if not exists shipping      numeric(10,2) not null default 0,
  add column if not exists locale        text not null default 'fr',
  add column if not exists expires_at    timestamptz,
  add column if not exists note          text,
  add column if not exists fulfilled_at  timestamptz,
  add column if not exists cancelled_at  timestamptz,
  add column if not exists refunded_at   timestamptz;
alter table public.orders alter column stripe_session_id drop not null;
alter table public.orders alter column amount_total drop not null;
alter table public.orders alter column amount_total drop default;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded'));

create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_payment_intent_idx on public.orders (stripe_payment_intent);

alter table public.orders enable row level security;
-- (Volontairement AUCUNE policy : même un SELECT anonyme est refusé.)


-- 3) FONCTIONS DE STOCK ----------------------------------------
--    Appelées par le serveur (service_role) uniquement — voir les droits en 4).

-- Réserve le stock et crée la commande « pending », tout ou rien.
--   p_items : [{"variant_id": "<uuid>", "quantity": 2}, …]
-- Erreurs (message) :
--   shop:empty     panier vide ou mal formé ;
--   shop:quantity  quantité hors de 1..10, ou plus de 20 lignes ;
--   shop:stock     au moins une ligne indisponible — DETAIL : liste JSON des
--                  variant_id concernés (toutes, pas seulement la première).
create or replace function public.shop_reserve_order(
  p_items       jsonb,
  p_shipping    numeric,
  p_locale      text,
  p_ttl_minutes integer default 30
) returns public.orders
language plpgsql
set search_path = public
as $$
declare
  v_line     record;
  v_row      record;
  v_items    jsonb := '[]'::jsonb;
  v_short    jsonb := '[]'::jsonb;
  v_subtotal numeric(10,2) := 0;
  v_name     text;
  v_order    public.orders;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'shop:empty';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception using errcode = 'P0001', message = 'shop:quantity';
  end if;

  -- Doublons regroupés, puis variantes verrouillées dans un ordre FIXE : deux
  -- paniers qui se croisent (A puis B, B puis A) ne s'interbloquent jamais.
  -- `pos` garde l'ordre du panier, rétabli plus bas pour le reçu.
  for v_line in
    select r.variant_id, sum(r.quantity)::int as quantity, min(r.ord) as pos
    from rows from (jsonb_to_recordset(p_items) as (variant_id uuid, quantity int))
         with ordinality as r(variant_id, quantity, ord)
    group by r.variant_id
    order by r.variant_id
  loop
    if v_line.variant_id is null or v_line.quantity is null
       or v_line.quantity < 1 or v_line.quantity > 10 then
      raise exception using errcode = 'P0001', message = 'shop:quantity';
    end if;

    select v.id, v.size, v.stock, p.id as product_id, p.slug, p.name, p.name_en,
           p.price, p.image, p.active, p.available
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_line.variant_id
       for update of v;

    if not found or not v_row.active or not v_row.available or v_row.stock < v_line.quantity then
      v_short := v_short || to_jsonb(v_line.variant_id::text);
      continue;
    end if;

    update public.product_variants set stock = stock - v_line.quantity where id = v_row.id;

    v_name := case when p_locale = 'en' and coalesce(btrim(v_row.name_en), '') <> ''
                   then v_row.name_en else v_row.name end;
    v_items := v_items || jsonb_build_object(
      'variant_id',  v_row.id,
      'product_id',  v_row.product_id,
      'slug',        v_row.slug,
      'name',        v_name,
      'size',        v_row.size,
      'quantity',    v_line.quantity,
      'unit_amount', round(v_row.price * 100)::int,
      'image',       v_row.image,
      'pos',         v_line.pos
    );
    v_subtotal := v_subtotal + v_row.price * v_line.quantity;
  end loop;

  -- Une seule ligne manquante annule tout : l'exception défait aussi les
  -- décréments déjà faits dans cette transaction.
  if jsonb_array_length(v_short) > 0 then
    raise exception using errcode = 'P0001', message = 'shop:stock', detail = v_short::text;
  end if;

  -- Lignes remises dans l'ordre du panier (reçu, page de paiement).
  select jsonb_agg(e - 'pos' order by (e->>'pos')::bigint) into v_items
    from jsonb_array_elements(v_items) as e;

  insert into public.orders (status, items, subtotal, shipping, locale, expires_at)
  values ('pending', v_items, v_subtotal, coalesce(p_shipping, 0),
          case when p_locale = 'en' then 'en' else 'fr' end,
          now() + make_interval(mins => greatest(coalesce(p_ttl_minutes, 30), 1)))
  returning * into v_order;

  return v_order;
end;
$$;

-- Rend le stock d'une commande « pending » et la passe « cancelled ».
-- Vrai si ELLE a rendu le stock ; faux si la commande n'était plus en attente
-- (déjà rendue, payée…) : deux appels simultanés ne rendent jamais deux fois.
create or replace function public.shop_release_order(p_order uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_items jsonb;
begin
  update public.orders
     set status = 'cancelled', cancelled_at = now()
   where id = p_order and status = 'pending'
  returning items into v_items;

  if not found then
    return false;
  end if;

  -- Une taille supprimée entre-temps est simplement ignorée.
  update public.product_variants v
     set stock = v.stock + i.quantity
    from jsonb_to_recordset(v_items) as i(variant_id uuid, quantity int)
   where v.id = i.variant_id;

  return true;
end;
$$;

-- Marque une commande payée (webhook Stripe). Renvoie :
--   'paid'      : passage pending → paid ;
--   'already'   : déjà payée, expédiée ou remboursée (webhook rejoué) ;
--   'paid_late' : la réservation avait été rendue avant que le paiement
--                 n'aboutisse — le stock est repris au mieux et une note
--                 prévient le staff ;
--   'missing'   : commande inconnue.
create or replace function public.shop_mark_paid(
  p_order          uuid,
  p_session        text,
  p_payment_intent text,
  p_amount         numeric,
  p_email          text,
  p_name           text,
  p_address        jsonb
) returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_items  jsonb;
begin
  update public.orders
     set status = 'paid', paid_at = now(),
         stripe_session_id = coalesce(p_session, stripe_session_id),
         stripe_payment_intent = p_payment_intent,
         amount_total = p_amount,
         customer_email = p_email, customer_name = p_name, shipping_address = p_address
   where id = p_order and status = 'pending';
  if found then
    return 'paid';
  end if;

  select status into v_status from public.orders where id = p_order;
  if not found then
    return 'missing';
  end if;
  if v_status <> 'cancelled' then
    return 'already';
  end if;

  update public.orders
     set status = 'paid', paid_at = now(), cancelled_at = null,
         stripe_session_id = coalesce(p_session, stripe_session_id),
         stripe_payment_intent = p_payment_intent,
         amount_total = p_amount,
         customer_email = p_email, customer_name = p_name, shipping_address = p_address,
         note = 'Paiement reçu après la fin de la réservation : stock à vérifier avant expédition.'
   where id = p_order and status = 'cancelled'
  returning items into v_items;
  if not found then
    return 'already';
  end if;

  update public.product_variants v
     set stock = greatest(v.stock - i.quantity, 0)
    from jsonb_to_recordset(v_items) as i(variant_id uuid, quantity int)
   where v.id = i.variant_id;

  return 'paid_late';
end;
$$;


-- 4) DROITS ----------------------------------------------------
--    Supabase rend par défaut toute fonction du schéma public appelable par
--    tous via l'API (`/rest/v1/rpc/…`). Celles-ci touchent au stock et aux
--    commandes : réservées au serveur.

revoke all on function public.shop_reserve_order(jsonb, numeric, text, integer) from public, anon, authenticated;
revoke all on function public.shop_release_order(uuid) from public, anon, authenticated;
revoke all on function public.shop_mark_paid(uuid, text, text, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.shop_reserve_order(jsonb, numeric, text, integer) to service_role;
grant execute on function public.shop_release_order(uuid) to service_role;
grant execute on function public.shop_mark_paid(uuid, text, text, numeric, text, text, jsonb) to service_role;


-- 5) CONSERVATION ----------------------------------------------
--    Les commandes sont des pièces comptables : elles ne rejoignent PAS la
--    purge RGPD automatique (/api/cron/purge), qui ne touche qu'aux
--    candidatures et messages de support.
