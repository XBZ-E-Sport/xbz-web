-- ============================================================
--  XBZ Esport — Personnalisation d'un article (nom et numéro sur le maillot)
--  À exécuter dans Supabase → SQL Editor, AVANT de déployer le code qui
--  l'utilise. Rejouable sans risque.
--
--  La personnalisation est un INTERRUPTEUR par produit, éteint par défaut :
--  rien ne change sur le site tant que le staff ne la coche pas dans
--  Back-office → Boutique (« Personnalisation nom et numéro »).
--
--  Un article personnalisé à la demande du client est exclu du droit de
--  rétractation (article L.221-28, 3° du Code de la consommation) : la fiche
--  produit et le panier le disent avant la commande.
-- ============================================================

-- 1) Réglage par produit -----------------------------------------------------
alter table public.products
  add column if not exists personalizable boolean not null default false;

-- Supplément pour la personnalisation, en euros TTC, par pièce personnalisée.
alter table public.products
  add column if not exists personalization_price numeric(10,2) not null default 0
  check (personalization_price >= 0 and personalization_price <= 100);


-- 2) Réservation : une ligne = une taille ET (éventuellement) un nom / numéro ----
--    Même signature qu'avant. Chaque élément de `p_items` peut porter
--    `print_name` (texte, 12 caractères au plus) et/ou `print_number` (0 à 99).
--    Deux lignes d'une même taille avec des textes différents sont deux articles.
--    Le stock, lui, se compte PAR TAILLE : variante verrouillée une seule fois.
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
  v_var      record;
  v_part     record;
  v_row      record;
  v_items    jsonb := '[]'::jsonb;
  v_short    jsonb := '[]'::jsonb;
  v_subtotal numeric(10,2) := 0;
  v_name     text;
  v_unit     numeric(10,2);
  v_item     jsonb;
  v_order    public.orders;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'shop:empty';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception using errcode = 'P0001', message = 'shop:quantity';
  end if;

  -- Tailles verrouillées dans un ordre FIXE : deux paniers qui se croisent
  -- (A puis B, B puis A) ne s'interbloquent jamais.
  for v_var in
    select r.variant_id, sum(r.quantity)::int as quantity
    from jsonb_to_recordset(p_items)
         as r(variant_id uuid, quantity int, print_name text, print_number text)
    group by r.variant_id
    order by r.variant_id
  loop
    if v_var.variant_id is null or v_var.quantity is null
       or v_var.quantity < 1 or v_var.quantity > 10 then
      raise exception using errcode = 'P0001', message = 'shop:quantity';
    end if;

    select v.id, v.size, v.stock, p.id as product_id, p.slug, p.name, p.name_en,
           p.price, p.image, p.active, p.available,
           p.personalizable, p.personalization_price
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_var.variant_id
       for update of v;

    if not found or not v_row.active or not v_row.available or v_row.stock < v_var.quantity then
      v_short := v_short || to_jsonb(v_var.variant_id::text);
      continue;
    end if;

    update public.product_variants set stock = stock - v_var.quantity where id = v_row.id;

    v_name := case when p_locale = 'en' and coalesce(btrim(v_row.name_en), '') <> ''
                   then v_row.name_en else v_row.name end;

    -- Les lignes de CETTE taille, dans l'ordre du panier (`pos` le rétablit plus bas).
    for v_part in
      select r.quantity, r.print_name, r.print_number, r.ord
      from rows from (jsonb_to_recordset(p_items)
             as (variant_id uuid, quantity int, print_name text, print_number text))
           with ordinality as r(variant_id, quantity, print_name, print_number, ord)
      where r.variant_id = v_var.variant_id
      order by r.ord
    loop
      if v_part.quantity is null or v_part.quantity < 1 or v_part.quantity > 10 then
        raise exception using errcode = 'P0001', message = 'shop:quantity';
      end if;

      v_unit := v_row.price;
      v_item := jsonb_build_object(
        'variant_id',  v_row.id,
        'product_id',  v_row.product_id,
        'slug',        v_row.slug,
        'name',        v_name,
        'size',        v_row.size,
        'quantity',    v_part.quantity,
        'image',       v_row.image,
        'pos',         v_part.ord
      );

      if v_part.print_name is not null or v_part.print_number is not null then
        -- Personnalisation demandée : seulement sur un produit qui la propose,
        -- avec un nom (12 caractères au plus) et/ou un numéro (0 à 99).
        if not v_row.personalizable then
          raise exception using errcode = 'P0001', message = 'shop:personalization';
        end if;
        if (v_part.print_name is null and v_part.print_number is null)
           or (v_part.print_name is not null
               and (char_length(btrim(v_part.print_name)) not between 1 and 12
                    or v_part.print_name ~ '[[:cntrl:]]'))
           or (v_part.print_number is not null and v_part.print_number !~ '^([0-9]|[1-9][0-9])$') then
          raise exception using errcode = 'P0001', message = 'shop:personalization';
        end if;
        v_unit := v_unit + v_row.personalization_price;
        v_item := v_item || jsonb_build_object(
          'print', jsonb_strip_nulls(jsonb_build_object(
            'name',   btrim(v_part.print_name),
            'number', v_part.print_number,
            'extra',  round(v_row.personalization_price * 100)::int
          ))
        );
      end if;

      -- `unit_amount` = prix UNITAIRE PAYÉ (supplément compris) : tout ce qui
      -- additionne les lignes (reçu, export, back-office) reste juste.
      v_items := v_items || (v_item || jsonb_build_object('unit_amount', round(v_unit * 100)::int));
      v_subtotal := v_subtotal + v_unit * v_part.quantity;
    end loop;
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


-- 3) Restitution du stock : par TAILLE (deux lignes d'une même taille = une addition) --
--    Sans cela, `update … from` ne retiendrait qu'UNE des lignes de la taille et
--    le reste du stock ne serait jamais rendu.
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
    from (
      select r.variant_id, sum(r.quantity)::int as quantity
        from jsonb_to_recordset(v_items) as r(variant_id uuid, quantity int)
       group by r.variant_id
    ) i
   where v.id = i.variant_id;

  return true;
end;
$$;

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
    from (
      select r.variant_id, sum(r.quantity)::int as quantity
        from jsonb_to_recordset(v_items) as r(variant_id uuid, quantity int)
       group by r.variant_id
    ) i
   where v.id = i.variant_id;

  return 'paid_late';
end;
$$;


-- 4) Droits : inchangés (réservés au serveur), rappelés pour être sûr ------------
revoke all on function public.shop_reserve_order(jsonb, numeric, text, integer) from public, anon, authenticated;
revoke all on function public.shop_release_order(uuid) from public, anon, authenticated;
revoke all on function public.shop_mark_paid(uuid, text, text, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.shop_reserve_order(jsonb, numeric, text, integer) to service_role;
grant execute on function public.shop_release_order(uuid) to service_role;
grant execute on function public.shop_mark_paid(uuid, text, text, numeric, text, text, jsonb) to service_role;
