-- =====================================================
-- PLAN-19: Caja compartida por tienda (multi-usuario)
-- =====================================================
-- Convierte el modelo de caja de "una sesión `open` por USUARIO" a "una
-- sesión `open` por TIENDA": cualquier usuario activo de la tienda (admin o
-- cajero) puede vender y cerrar contra la única sesión abierta de su tienda,
-- conservando `cashier_id` por venta y `opened_by` por sesión (auditoría).
--
-- Cambio quirúrgico en DB, cero cambios Angular. Tres ajustes:
--   (a) Índice único ux_one_open_session_per_user (opened_by) where open
--       → ux_one_open_session_per_tienda (tienda_id) where open.
--   (b) create_sale_atomic: el check de caja abierta deja de exigir
--       `opened_by = p_cashier_id`; solo valida tienda + status='open'.
--   (c) close_cash_session_atomic: el gate "dueño o admin" se relaja a
--       "miembro activo de la tienda".
--
-- void_sale_atomic NO se toca (ya restringe a admin por PLAN-15).
-- `opened_by` NO se elimina: queda como auditoría de quién abrió la caja.
-- Se reutiliza la política RLS existente `tenant_isolation` (sin cambios).
--
-- NO aplicar al remoto desde aquí: migración versionada, se aplica vía pipeline.
-- =====================================================

-- ---------- (a) Reemplazo de índice único ----------
-- Paso 1 (saneamiento de datos legacy): bajo el modelo per-usuario podían
-- coexistir varias sesiones `open` en una misma tienda (una por cajero). El
-- nuevo índice parcial por tienda lo prohíbe, así que primero consolidamos:
-- conservamos la sesión open más reciente por tienda y cerramos las demás.
-- DEBE ejecutarse ANTES del drop/create del índice para no fallar por datos
-- preexistentes.
with ranked as (
  select id, row_number() over (partition by tienda_id order by opened_at desc) as rn
  from public.cash_sessions where status = 'open'
)
update public.cash_sessions cs
set status = 'closed', closed_at = now(),
    notas_cierre = coalesce(nullif(btrim(cs.notas_cierre), ''),
      'Cerrada automáticamente por migración PLAN-19 (consolidación a caja compartida por tienda)')
from ranked where cs.id = ranked.id and ranked.rn > 1;

-- Paso 2: del índice per-usuario al índice per-tienda. El índice real vigente
-- es ux_one_open_session_per_user (20260426_002_cash_sales_billing_settings.sql:32).
drop index if exists public.ux_one_open_session_per_user;
create unique index if not exists ux_one_open_session_per_tienda
  on public.cash_sessions (tienda_id) where status = 'open';

-- ---------- (b) create_sale_atomic — caja compartida por tienda ----------
-- Cuerpo idéntico a 20260527_002_correlative_sale_number.sql (correlativo
-- V-NNNNNN server-side, idempotencia, validación de pagos/cambio, stock,
-- sale_counters, firma de 12 params) SALVO el bloque de validación de caja:
-- se elimina `and opened_by = p_cashier_id` para que cualquier cajero pueda
-- vender contra la sesión abierta de la tienda.

create or replace function create_sale_atomic(
  p_tienda_id        uuid,
  p_cash_session_id  uuid,
  p_sale_number      text,
  p_cashier_id       uuid,
  p_cliente_id       uuid,
  p_subtotal         numeric,
  p_discount_total   numeric,
  p_tax_total        numeric,
  p_total            numeric,
  p_idempotency_key  text,
  p_items            jsonb,
  p_payments         jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_pay jsonb;
  v_product record;
  v_current_stock numeric;
  v_total_paid numeric;
  v_cash_paid numeric;
  v_non_cash_paid numeric;
  v_quantity numeric;
  v_seq bigint;
  v_sale_number text;
begin
  -- p_sale_number se ignora a propósito: el número se genera server-side.
  select id into v_sale_id
  from sales
  where idempotency_key = p_idempotency_key
    and tienda_id = p_tienda_id;

  if v_sale_id is not null then
    return v_sale_id;
  end if;

  -- PLAN-19: caja compartida por tienda. La sesión solo debe estar abierta y
  -- pertenecer a la tienda; ya NO se exige que la haya abierto el cajero
  -- (`opened_by = p_cashier_id` eliminado). El cajero queda registrado en
  -- sales.cashier_id; quién abrió la caja queda en cash_sessions.opened_by.
  if not exists (
    select 1
    from cash_sessions
    where id = p_cash_session_id
      and tienda_id = p_tienda_id
      and status = 'open'
  ) then
    raise exception 'No hay caja abierta para esta venta';
  end if;

  select coalesce(sum((value->>'amount')::numeric), 0)
  into v_total_paid
  from jsonb_array_elements(p_payments);

  select coalesce(sum((value->>'amount')::numeric), 0)
  into v_cash_paid
  from jsonb_array_elements(p_payments)
  where value->>'metodo' = 'cash';

  v_non_cash_paid := v_total_paid - v_cash_paid;

  if v_total_paid < p_total then
    raise exception 'La suma de pagos no cubre el total de la venta';
  end if;

  if v_non_cash_paid > p_total or (v_total_paid - p_total) > v_cash_paid then
    raise exception 'El cambio solo puede generarse desde pagos en efectivo';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;

    select id, tipo, is_active
    into v_product
    from productos
    where id = (v_item->>'producto_id')::uuid
      and tienda_id = p_tienda_id;

    if v_product.id is null or not v_product.is_active then
      raise exception 'Producto no disponible';
    end if;

    if v_product.tipo <> 'prepared' then
      perform pg_advisory_xact_lock(hashtextextended(v_product.id::text, 0));

      select get_stock(v_product.id, p_tienda_id)
      into v_current_stock;

      if v_current_stock < v_quantity then
        raise exception 'Stock insuficiente';
      end if;
    end if;
  end loop;

  -- Número correlativo server-side: upsert atómico (row lock por tienda).
  -- Va DESPUÉS de idempotencia y validaciones, justo antes del insert en sales,
  -- para que un reintento (idempotency_key repetida) no consuma número.
  insert into sale_counters (tienda_id, last_number)
  values (p_tienda_id, 1)
  on conflict (tienda_id)
  do update set last_number = sale_counters.last_number + 1
  returning last_number into v_seq;

  v_sale_number := 'V-' || lpad(v_seq::text, 6, '0');

  insert into sales (
    tienda_id, cash_session_id, sale_number, cashier_id, cliente_id,
    subtotal, discount_total, tax_total, total, idempotency_key
  ) values (
    p_tienda_id, p_cash_session_id, v_sale_number, p_cashier_id, p_cliente_id,
    p_subtotal, p_discount_total, p_tax_total, p_total, p_idempotency_key
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into sale_items (
      sale_id, producto_id, producto_nombre, producto_sku,
      quantity, unit_price, discount_amount, tax_rate, tax_amount, total
    ) values (
      v_sale_id,
      (v_item->>'producto_id')::uuid,
      v_item->>'producto_nombre',
      v_item->>'producto_sku',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'discount_amount')::numeric,
      (v_item->>'tax_rate')::numeric,
      (v_item->>'tax_amount')::numeric,
      (v_item->>'total')::numeric
    );
  end loop;

  for v_pay in select value from jsonb_array_elements(p_payments)
  loop
    insert into payments (sale_id, metodo, amount, referencia)
    values (
      v_sale_id,
      (v_pay->>'metodo')::payment_method,
      (v_pay->>'amount')::numeric,
      v_pay->>'referencia'
    );
  end loop;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select tipo
    into v_product
    from productos
    where id = (v_item->>'producto_id')::uuid
      and tienda_id = p_tienda_id;

    if v_product.tipo <> 'prepared' then
      insert into inventory_movements (
        tienda_id, producto_id, tipo, cantidad,
        referencia_tipo, referencia_id, created_by
      ) values (
        p_tienda_id,
        (v_item->>'producto_id')::uuid,
        'sale_exit',
        -((v_item->>'quantity')::numeric),
        'sale',
        v_sale_id,
        p_cashier_id
      );
    end if;
  end loop;

  return v_sale_id;
end;
$$;

comment on function create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
) is
  'Crea una venta de forma atómica. Genera sale_number correlativo por tienda (V-NNNNNN) server-side vía sale_counters; el parámetro p_sale_number se mantiene por compatibilidad de firma pero se ignora. PLAN-19: la validación de caja exige solo sesión open de la tienda (caja compartida), no que la haya abierto el cajero.';

grant execute on function create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
) to authenticated;

-- ---------- (c) close_cash_session_atomic — cierre por cualquier miembro ----------
-- Cuerpo idéntico a 20260508_003_close_cash_session_atomic.sql SALVO el gate de
-- permisos: el modelo "dueño (opened_by) o admin" se relaja a "cualquier
-- usuario activo de la tienda" (caja compartida). El resto (breakdown,
-- threshold $5000, update, audit_log, closed_by = p_closed_by, validación
-- v_uid <> p_closed_by, revoke/grant) queda intacto.

create or replace function public.close_cash_session_atomic(
  p_session_id      uuid,
  p_tienda_id       uuid,
  p_closed_by       uuid,
  p_actual_cash     numeric,
  p_actual_payments jsonb,        -- [{ "metodo": "card", "total": 12345 }, ...]
  p_notas_cierre    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                 uuid := auth.uid();
  v_session             record;
  v_movs_total          numeric := 0;
  v_expected_cash_sales numeric := 0;
  v_expected_total      numeric := 0;
  v_actual_cash_sales   numeric;
  v_actual_total        numeric;
  v_cash_difference     numeric;
  v_sales_difference    numeric;
  v_expected_breakdown  jsonb;
  v_actual_breakdown    jsonb;
  v_threshold           numeric := 5000;
begin
  if v_uid is null or v_uid <> p_closed_by then
    raise exception 'No autenticado';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tienda_id = p_tienda_id
  for update;

  if v_session.id is null then
    raise exception 'Sesion no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La caja ya esta cerrada';
  end if;

  -- PLAN-19: caja compartida. Cualquier usuario activo de la tienda puede
  -- cerrar la sesión compartida (antes: solo el dueño `opened_by` o un admin).
  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and is_active = true
  ) then
    raise exception 'Solo un usuario activo de la tienda puede cerrar esta caja';
  end if;

  -- Total neto de movimientos (cash_in suma, resto resta).
  select coalesce(sum(case when tipo = 'cash_in' then amount else -amount end), 0)
    into v_movs_total
  from public.cash_movements
  where cash_session_id = p_session_id;

  -- Breakdown esperado por método de pago.
  with pay_sums as (
    select p.metodo::text as metodo, sum(p.amount)::numeric as total, count(*)::int as cnt
    from public.payments p
    join public.sales s on s.id = p.sale_id
    where s.cash_session_id = p_session_id
      and s.tienda_id = p_tienda_id
      and s.status = 'completed'
    group by p.metodo
  )
  select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'count', cnt, 'total', total)
                              order by total desc), '[]'::jsonb)
    into v_expected_breakdown
  from pay_sums;

  v_expected_cash_sales := coalesce(
    (select sum((m->>'total')::numeric)
     from jsonb_array_elements(v_expected_breakdown) m
     where m->>'metodo' = 'cash'), 0);

  v_expected_total := coalesce(
    (select sum((m->>'total')::numeric)
     from jsonb_array_elements(v_expected_breakdown) m), 0);

  v_actual_cash_sales := p_actual_cash - v_session.opening_amount - v_movs_total;

  -- Construye breakdown confirmado: efectivo derivado, resto desde p_actual_payments.
  with provided as (
    select coalesce(elem->>'metodo', '') as metodo,
           coalesce((elem->>'total')::numeric, 0) as total
    from jsonb_array_elements(coalesce(p_actual_payments, '[]'::jsonb)) elem
  ),
  by_method as (
    select metodo,
           case when metodo = 'cash' then v_actual_cash_sales
                else coalesce(sum(total), 0)
           end as total
    from provided
    where metodo <> ''
    group by metodo
  ),
  with_cash as (
    select 'cash' as metodo, v_actual_cash_sales as total
    union all
    select metodo, total from by_method where metodo <> 'cash'
  )
  select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'total', total)
                              order by total desc), '[]'::jsonb)
    into v_actual_breakdown
  from with_cash;

  v_actual_total := coalesce(
    (select sum((m->>'total')::numeric)
     from jsonb_array_elements(v_actual_breakdown) m), 0);

  v_cash_difference  := (v_session.opening_amount + v_expected_cash_sales + v_movs_total) - p_actual_cash;
  v_sales_difference := v_expected_total - v_actual_total;

  if (abs(v_cash_difference) > v_threshold or abs(v_sales_difference) > v_threshold)
     and (p_notas_cierre is null or btrim(p_notas_cierre) = '') then
    raise exception 'Diferencias mayores a $%.0f requieren nota de cierre', v_threshold;
  end if;

  update public.cash_sessions
  set status                = 'closed',
      closed_by             = p_closed_by,
      actual_cash_amount    = p_actual_cash,
      expected_cash_amount  = v_session.opening_amount + v_expected_cash_sales + v_movs_total,
      difference            = v_cash_difference,
      expected_sales_amount = v_expected_total,
      actual_sales_amount   = v_actual_total,
      sales_difference      = v_sales_difference,
      payment_closure       = jsonb_build_object('expected', v_expected_breakdown, 'actual', v_actual_breakdown),
      notas_cierre          = nullif(btrim(coalesce(p_notas_cierre, '')), ''),
      closed_at             = now()
  where id = p_session_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_closed_by, 'cash_session.closed', 'cash_session', p_session_id,
    jsonb_build_object(
      'cash_difference',  v_cash_difference,
      'sales_difference', v_sales_difference,
      'has_notes',        nullif(btrim(coalesce(p_notas_cierre, '')), '') is not null
    )
  );

  return p_session_id;
end;
$$;

revoke execute on function public.close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text) from public, anon;
grant  execute on function public.close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text) to authenticated;
