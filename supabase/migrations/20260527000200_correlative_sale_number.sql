-- =====================================================
-- PLAN-03: sale_number correlativo por tienda
-- =====================================================
-- Reemplaza el formato timestamp `YYMMDD-<epoch>` (generado en cliente, rompe
-- RN-S) por un correlativo `V-NNNNNN` estrictamente creciente y único por
-- tienda, generado de forma atómica DENTRO de create_sale_atomic (server-side).
--
-- - Tabla counter `sale_counters` (PK tienda_id) con RLS por tienda.
-- - El RPC IGNORA `p_sale_number` (se mantiene el parámetro para no romper la
--   firma ni los grants por firma de 20260508_001). El número se genera con un
--   upsert atómico (row lock por tienda) justo antes del insert en `sales`,
--   DESPUÉS del early-return de idempotencia (un reintento NO consume número).
-- - Históricos (`V-YYYYMMDD-NNN`) y timestamp (`260527-...`) quedan intactos;
--   `unique (tienda_id, sale_number)` protege ante colisiones.
--
-- NO aplicar al remoto desde aquí: migración versionada, se aplica vía pipeline.
-- =====================================================

-- ---------- Tabla counter por tienda ----------

create table if not exists sale_counters (
  tienda_id   uuid    primary key references tiendas (id) on delete cascade,
  last_number bigint  not null default 0
);

comment on table sale_counters is
  'Contador correlativo de sale_number por tienda. last_number es el último número emitido; el RPC create_sale_atomic lo incrementa atómicamente (row lock por tienda) para producir V-NNNNNN.';

alter table sale_counters enable row level security;

-- RLS coherente con 20260508_001: aislamiento por tienda. El RPC es security
-- invoker, el upsert corre como el cajero y la fila pertenece a su tienda.
drop policy if exists "tenant_isolation" on sale_counters;
create policy "tenant_isolation" on sale_counters
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()))
  with check (tienda_id in (select public.get_user_tiendas()));

-- ---------- create_sale_atomic con número server-side ----------
-- Cuerpo idéntico a 20260427_002_harden_sales_cash_logic.sql salvo:
--   - declara v_seq y v_sale_number,
--   - genera el número con upsert atómico antes del insert into sales,
--   - usa v_sale_number en lugar de p_sale_number (que ahora se ignora).

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

  if not exists (
    select 1
    from cash_sessions
    where id = p_cash_session_id
      and tienda_id = p_tienda_id
      and opened_by = p_cashier_id
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
  'Crea una venta de forma atómica. Genera sale_number correlativo por tienda (V-NNNNNN) server-side vía sale_counters; el parámetro p_sale_number se mantiene por compatibilidad de firma pero se ignora.';

grant execute on function create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
) to authenticated;
