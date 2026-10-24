-- =====================================================
-- Auditoría completa (2026-10-24)
-- =====================================================
-- Los registros escritos por funciones de la base (sale.voided,
-- cash_session.closed, inventory.adjusted, ...) llegaban sin correo del
-- usuario y sin nombre de la entidad, y la pantalla mostraba un UUID.
--
-- 1. audit_entity_label(): nombre legible de la entidad (producto, venta,
--    caja, movimiento, cliente, gasto...) para las dos convenciones de
--    entity_type que conviven (las de la app en español y las de la base).
-- 2. Trigger BEFORE INSERT en audit_logs: completa user_id, user_email y
--    entity_label cuando vienen vacíos. Así toda RPC, trigger o cliente
--    (web e iOS) queda completo sin tocar cada función.
-- 3. El ajuste de stock registra también la ubicación.
-- 4. register_expense_atomic audita la creación del gasto (expense.created).
-- =====================================================

create or replace function public.audit_entity_label(p_entity_type text, p_entity_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text;
begin
  if p_entity_id is null then
    return null;
  end if;

  case p_entity_type
    when 'product', 'producto' then
      select nombre into v_label from public.productos where id = p_entity_id;
    when 'sale', 'venta' then
      select sale_number into v_label from public.sales where id = p_entity_id;
    when 'payment' then
      select s.sale_number into v_label
      from public.payments p join public.sales s on s.id = p.sale_id
      where p.id = p_entity_id;
    when 'cash_session', 'sesion_caja' then
      select 'Caja del ' || to_char(cs.opened_at at time zone coalesce(t.timezone, 'America/Bogota'), 'DD/MM/YYYY HH24:MI')
      into v_label
      from public.cash_sessions cs join public.tiendas t on t.id = cs.tienda_id
      where cs.id = p_entity_id;
    when 'cash_movement', 'movimiento_caja' then
      select motivo into v_label from public.cash_movements where id = p_entity_id;
    when 'inventory_movement', 'movimiento_inventario' then
      -- Un traslado se registra con el id del traslado (referencia_id de sus dos movimientos).
      select pr.nombre into v_label
      from public.inventory_movements m join public.productos pr on pr.id = m.producto_id
      where m.id = p_entity_id or m.referencia_id = p_entity_id
      limit 1;
    when 'cliente', 'customer' then
      select nombre into v_label from public.clientes where id = p_entity_id;
    when 'loyalty_account' then
      -- adjust_loyalty_stamps registra el id del cliente; otros, el de la cuenta.
      select c.nombre into v_label
      from public.clientes c
      where c.id = p_entity_id
         or c.id = (select la.cliente_id from public.loyalty_accounts la where la.id = p_entity_id);
    when 'expense' then
      select concepto into v_label from public.expenses where id = p_entity_id;
    else
      v_label := null;
  end case;

  return v_label;
end;
$$;

revoke all on function public.audit_entity_label(text, uuid) from public, anon, authenticated;

create or replace function public.tg_audit_logs_enrich()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if coalesce(new.user_email, '') = '' and new.user_id is not null then
    select coalesce(email, '') into new.user_email from auth.users where id = new.user_id;
    new.user_email := coalesce(new.user_email, '');
  end if;

  -- Sin nombre, o con un id en su lugar (algunos clientes mandan el id del
  -- producto cuando no tienen el nombre a mano).
  if new.entity_label is null or new.entity_label ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.entity_label := coalesce(public.audit_entity_label(new.entity_type, new.entity_id), new.entity_label);
  end if;

  return new;
end;
$$;

revoke all on function public.tg_audit_logs_enrich() from public, anon, authenticated;

drop trigger if exists tr_audit_logs_enrich on public.audit_logs;
create trigger tr_audit_logs_enrich
  before insert on public.audit_logs
  for each row execute function public.tg_audit_logs_enrich();

-- -----------------------------------------------------
-- Ajuste de stock: también la ubicación.
-- -----------------------------------------------------
create or replace function public.tg_audit_inventory_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'adjustment' then
    insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
    values (
      new.tienda_id,
      auth.uid(),
      'inventory.adjusted',
      'product',
      new.producto_id,
      jsonb_build_object(
        'cantidad',  new.cantidad,
        'ubicacion', new.ubicacion,
        'motivo',    new.motivo
      )
    );
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------
-- register_expense_atomic: audita la creación del gasto.
-- Mismo cuerpo que antes; solo se agrega el insert en audit_logs.
-- -----------------------------------------------------
create or replace function public.register_expense_atomic(
  p_tienda_id uuid,
  p_category_id uuid,
  p_concepto text,
  p_monto numeric,
  p_metodo_pago text,
  p_empleado_id uuid default null,
  p_notas text default null,
  p_fecha_gasto date default null,
  p_periodo text default null,
  p_idempotency_key text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user        uuid := auth.uid();
  v_session_id  uuid;
  v_movement_id uuid;
  v_key         text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_expense     public.expenses;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_user
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede registrar gastos';
  end if;

  if v_key is not null then
    select * into v_expense
    from public.expenses
    where tienda_id = p_tienda_id and idempotency_key = v_key;
    if v_expense.id is not null then
      return v_expense;
    end if;
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if not exists (
    select 1 from public.expense_categories
    where id = p_category_id and tienda_id = p_tienda_id
  ) then
    raise exception 'Categoría de gasto no encontrada';
  end if;

  if p_empleado_id is not null and not exists (
    select 1 from public.empleados
    where id = p_empleado_id and tienda_id = p_tienda_id
  ) then
    raise exception 'Empleado no encontrado';
  end if;

  if p_metodo_pago = 'efectivo_caja' then
    select id into v_session_id
    from public.cash_sessions
    where tienda_id = p_tienda_id
      and status = 'open'
    order by opened_at desc
    limit 1;

    if v_session_id is null then
      raise exception 'NO_OPEN_CASH_SESSION';
    end if;

    insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
    values (v_session_id, 'expense', p_monto, 'Gasto: ' || p_concepto, v_user)
    returning id into v_movement_id;
  end if;

  insert into public.expenses (
    tienda_id, category_id, empleado_id, concepto, notas, monto,
    fecha_gasto, metodo_pago, cash_movement_id, periodo, created_by, idempotency_key
  ) values (
    p_tienda_id, p_category_id, p_empleado_id, p_concepto, p_notas, p_monto,
    coalesce(p_fecha_gasto, current_date), p_metodo_pago, v_movement_id, p_periodo, v_user, v_key
  )
  returning * into v_expense;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, entity_label, metadata)
  values (
    p_tienda_id, v_user, 'expense.created', 'expense', v_expense.id, v_expense.concepto,
    jsonb_build_object(
      'monto',            v_expense.monto,
      'categoria',        (select nombre from public.expense_categories where id = p_category_id),
      'metodo_pago',      v_expense.metodo_pago,
      'fecha_gasto',      v_expense.fecha_gasto,
      'periodo',          v_expense.periodo,
      'empleado',         (select nombre from public.empleados where id = p_empleado_id),
      'cash_movement_id', v_movement_id
    )
  );

  return v_expense;
exception
  -- Carrera con la misma clave: se devuelve el gasto de la primera petición
  -- (la transacción de esta, incluido su egreso de caja, se revierte).
  when unique_violation then
    if v_key is null then
      raise;
    end if;
    select * into v_expense
    from public.expenses
    where tienda_id = p_tienda_id and idempotency_key = v_key;
    if v_expense.id is null then
      raise;
    end if;
    return v_expense;
end;
$$;

-- -----------------------------------------------------
-- close_cash_session_atomic: el registro del cierre incluye la base, el
-- efectivo esperado y el texto de la nota (antes solo `has_notes`). Mismo
-- cuerpo que antes; solo cambia el jsonb de audit_logs.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_cash_session_atomic(p_session_id uuid, p_tienda_id uuid, p_closed_by uuid, p_actual_cash numeric, p_cash_left numeric, p_actual_payments jsonb, p_notas_cierre text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid                       uuid := auth.uid();
  v_closed_by_email           text;
  v_session                   record;
  v_movs_total                numeric := 0;
  v_expected_cash_sales       numeric := 0;
  v_expected_total            numeric := 0;
  v_actual_cash_sales         numeric;
  v_actual_total              numeric;
  v_cash_difference           numeric;
  v_sales_difference          numeric;
  v_closing_withdrawal_amount numeric;
  v_expected_breakdown        jsonb;
  v_actual_breakdown          jsonb;
  v_threshold                 numeric := 5000;
begin
  if v_uid is null or v_uid <> p_closed_by then
    raise exception 'No autenticado';
  end if;

  if p_actual_cash is null then
    raise exception 'El efectivo contado es obligatorio';
  end if;

  if p_cash_left is null then
    raise exception 'El efectivo dejado es obligatorio';
  end if;

  if p_actual_cash < 0 then
    raise exception 'El efectivo contado no puede ser negativo';
  end if;

  if p_cash_left < 0 then
    raise exception 'El efectivo dejado no puede ser negativo';
  end if;

  if p_cash_left > p_actual_cash then
    raise exception 'El efectivo dejado no puede superar el efectivo contado';
  end if;

  v_closed_by_email := nullif(auth.jwt() ->> 'email', '');
  if v_closed_by_email is null then
    select email into v_closed_by_email from auth.users where id = v_uid;
  end if;
  v_closing_withdrawal_amount := p_actual_cash - p_cash_left;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id
    and tienda_id = p_tienda_id
  for update;

  if v_session.id is null then
    raise exception 'Sesion no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La caja ya esta cerrada';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'Solo un usuario activo de la tienda puede cerrar esta caja';
  end if;

  select coalesce(sum(case when tipo = 'cash_in' then amount else -amount end), 0)
    into v_movs_total
  from public.cash_movements
  where cash_session_id = p_session_id
    and status = 'active';

  with pay_sums as (
    select p.metodo::text as metodo,
           sum(p.amount)::numeric as total,
           count(*)::int as cnt
    from public.payments p
    join public.sales s on s.id = p.sale_id
    where s.cash_session_id = p_session_id
      and s.tienda_id = p_tienda_id
      and s.status = 'completed'
    group by p.metodo
  )
  select coalesce(
      jsonb_agg(
        jsonb_build_object('metodo', metodo, 'count', cnt, 'total', total)
        order by total desc
      ),
      '[]'::jsonb
    )
    into v_expected_breakdown
  from pay_sums;

  v_expected_cash_sales := coalesce(
    (
      select sum((method->>'total')::numeric)
      from jsonb_array_elements(v_expected_breakdown) method
      where method->>'metodo' = 'cash'
    ),
    0
  );

  v_expected_total := coalesce(
    (
      select sum((method->>'total')::numeric)
      from jsonb_array_elements(v_expected_breakdown) method
    ),
    0
  );

  v_actual_cash_sales := p_actual_cash - v_session.opening_amount - v_movs_total;

  with provided as (
    select coalesce(element->>'metodo', '') as metodo,
           coalesce((element->>'total')::numeric, 0) as total
    from jsonb_array_elements(coalesce(p_actual_payments, '[]'::jsonb)) element
  ),
  by_method as (
    select metodo,
           case
             when metodo = 'cash' then v_actual_cash_sales
             else coalesce(sum(total), 0)
           end as total
    from provided
    where metodo <> ''
    group by metodo
  ),
  with_cash as (
    select 'cash' as metodo, v_actual_cash_sales as total
    union all
    select metodo, total
    from by_method
    where metodo <> 'cash'
  )
  select coalesce(
      jsonb_agg(
        jsonb_build_object('metodo', metodo, 'total', total)
        order by total desc
      ),
      '[]'::jsonb
    )
    into v_actual_breakdown
  from with_cash;

  v_actual_total := coalesce(
    (
      select sum((method->>'total')::numeric)
      from jsonb_array_elements(v_actual_breakdown) method
    ),
    0
  );

  v_cash_difference :=
    (v_session.opening_amount + v_expected_cash_sales + v_movs_total) - p_actual_cash;
  v_sales_difference := v_expected_total - v_actual_total;

  if (abs(v_cash_difference) > v_threshold or abs(v_sales_difference) > v_threshold)
     and (p_notas_cierre is null or btrim(p_notas_cierre) = '') then
    raise exception 'Diferencias mayores a $%.0f requieren nota de cierre', v_threshold;
  end if;

  update public.cash_sessions
  set status                    = 'closed',
      closed_by                 = p_closed_by,
      closed_by_email           = v_closed_by_email,
      actual_cash_amount        = p_actual_cash,
      expected_cash_amount      = v_session.opening_amount + v_expected_cash_sales + v_movs_total,
      difference                = v_cash_difference,
      expected_sales_amount     = v_expected_total,
      actual_sales_amount       = v_actual_total,
      sales_difference          = v_sales_difference,
      payment_closure           = jsonb_build_object(
        'expected', v_expected_breakdown,
        'actual', v_actual_breakdown
      ),
      closing_withdrawal_amount = v_closing_withdrawal_amount,
      cash_left_amount          = p_cash_left,
      notas_cierre              = nullif(btrim(coalesce(p_notas_cierre, '')), ''),
      closed_at                 = now()
  where id = p_session_id;

  insert into public.audit_logs (
    tienda_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_tienda_id,
    p_closed_by,
    'cash_session.closed',
    'cash_session',
    p_session_id,
    jsonb_build_object(
      'cash_difference', v_cash_difference,
      'sales_difference', v_sales_difference,
      'has_notes', nullif(btrim(coalesce(p_notas_cierre, '')), '') is not null,
      'actual_cash_amount', p_actual_cash,
      'closing_withdrawal_amount', v_closing_withdrawal_amount,
      'cash_left_amount', p_cash_left,
      'opening_amount', v_session.opening_amount,
      'expected_cash_amount', v_session.opening_amount + v_expected_cash_sales + v_movs_total,
      'notas_cierre', nullif(btrim(coalesce(p_notas_cierre, '')), '')
    )
  );

  return p_session_id;
end;
$function$;
