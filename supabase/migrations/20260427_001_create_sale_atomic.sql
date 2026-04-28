-- Función atómica para crear una venta completa en una sola transacción.
-- Reemplaza los 4 inserts secuenciales del repositorio TypeScript y elimina
-- el riesgo de inconsistencia si alguno falla a mitad del proceso.
--
-- Parámetros:
--   p_items     JSONB array de { producto_id, producto_nombre, producto_sku,
--                                quantity, unit_price, discount_amount,
--                                tax_rate, tax_amount, total }
--   p_payments  JSONB array de { metodo, amount, referencia? }
--
-- Retorna: UUID de la venta creada (o la existente si ya hay idempotency_key)

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
  v_item    jsonb;
  v_pay     jsonb;
begin
  -- Idempotencia: si ya existe una venta con esa key, devolverla directamente
  select id into v_sale_id
  from sales
  where idempotency_key = p_idempotency_key
    and tienda_id       = p_tienda_id;

  if v_sale_id is not null then
    return v_sale_id;
  end if;

  -- 1. Insertar cabecera de venta
  insert into sales (
    tienda_id, cash_session_id, sale_number, cashier_id, cliente_id,
    subtotal, discount_total, tax_total, total, idempotency_key
  ) values (
    p_tienda_id, p_cash_session_id, p_sale_number, p_cashier_id, p_cliente_id,
    p_subtotal, p_discount_total, p_tax_total, p_total, p_idempotency_key
  )
  returning id into v_sale_id;

  -- 2. Insertar ítems de venta
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

  -- 3. Insertar pagos
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

  -- 4. Descontar stock (movimientos sale_exit) — dentro de la misma transacción
  for v_item in select value from jsonb_array_elements(p_items)
  loop
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
  end loop;

  return v_sale_id;
end;
$$;

-- Permisos: solo roles autenticados (RLS de las tablas aplica dentro de la función
-- porque usamos security invoker, no security definer)
grant execute on function create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
) to authenticated;
