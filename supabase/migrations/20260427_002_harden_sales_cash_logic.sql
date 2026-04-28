-- Endurece lógica crítica de ventas/caja:
-- - create_sale_atomic valida pagos y stock dentro de la transacción.
-- - Productos prepared no descuentan inventario en MVP.
-- - void_sale_atomic anula venta y repone inventario en una sola transacción.

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
begin
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

  insert into sales (
    tienda_id, cash_session_id, sale_number, cashier_id, cliente_id,
    subtotal, discount_total, tax_total, total, idempotency_key
  ) values (
    p_tienda_id, p_cash_session_id, p_sale_number, p_cashier_id, p_cliente_id,
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

grant execute on function create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
) to authenticated;

create or replace function void_sale_atomic(
  p_sale_id uuid,
  p_tienda_id uuid,
  p_voided_by uuid,
  p_voided_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_voided_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede anular ventas';
  end if;

  update sales
  set status = 'voided',
      voided_by = p_voided_by,
      voided_at = now(),
      voided_reason = p_voided_reason
  where id = p_sale_id
    and tienda_id = p_tienda_id
    and status = 'completed'
  returning id into v_sale_id;

  if v_sale_id is null then
    raise exception 'Venta no encontrada o ya anulada';
  end if;

  insert into inventory_movements (
    tienda_id, producto_id, tipo, cantidad,
    referencia_tipo, referencia_id, created_by, motivo
  )
  select
    p_tienda_id,
    si.producto_id,
    'void_return',
    si.quantity,
    'sale',
    p_sale_id,
    p_voided_by,
    p_voided_reason
  from sale_items si
  join productos p on p.id = si.producto_id
  where si.sale_id = p_sale_id
    and p.tipo <> 'prepared';

  insert into audit_logs (
    tienda_id, user_id, action, entity_type, entity_id, metadata
  ) values (
    p_tienda_id,
    p_voided_by,
    'sale.voided',
    'sale',
    p_sale_id,
    jsonb_build_object('reason', p_voided_reason)
  );

  return v_sale_id;
end;
$$;

grant execute on function void_sale_atomic(uuid, uuid, uuid, text) to authenticated;
