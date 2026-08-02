-- =====================================================
-- Trazabilidad y control autoritativo de descuentos
-- =====================================================

alter table public.sales
  add column if not exists item_discount_total numeric(14,2) not null default 0,
  add column if not exists global_discount_total numeric(14,2) not null default 0,
  add column if not exists discount_reason text,
  add column if not exists discount_approved_by uuid references auth.users(id);

alter table public.sale_items
  add column if not exists global_discount_amount numeric(14,2) not null default 0;

update public.sales
set item_discount_total = discount_total,
    global_discount_total = 0,
    discount_reason = coalesce(discount_reason, 'Histórico sin motivo')
where item_discount_total = 0
  and global_discount_total = 0
  and discount_total > 0;

alter table public.sales
  drop constraint if exists sales_discount_breakdown_check,
  add constraint sales_discount_breakdown_check check (
    discount_total = item_discount_total + global_discount_total
    and item_discount_total >= 0
    and global_discount_total >= 0
  ),
  drop constraint if exists sales_discount_reason_check,
  add constraint sales_discount_reason_check check (
    discount_total = 0 or length(btrim(coalesce(discount_reason, ''))) >= 3
  );

alter table public.sale_items
  drop constraint if exists sale_items_global_discount_nonnegative,
  add constraint sale_items_global_discount_nonnegative check (global_discount_amount >= 0);

drop function if exists public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
);

create or replace function public.create_sale_atomic(
  p_tienda_id             uuid,
  p_cash_session_id       uuid,
  p_sale_number           text,
  p_cashier_id            uuid,
  p_cliente_id            uuid,
  p_subtotal              numeric,
  p_discount_total        numeric,
  p_tax_total             numeric,
  p_total                 numeric,
  p_idempotency_key       text,
  p_items                 jsonb,
  p_payments              jsonb,
  p_global_discount_total numeric,
  p_discount_reason       text
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
  v_role public.user_role;
  v_current_stock numeric;
  v_quantity numeric;
  v_unit_discount numeric;
  v_line_subtotal numeric;
  v_line_item_discount numeric;
  v_line_before_global numeric;
  v_line_global_discount numeric;
  v_line_total numeric;
  v_line_base numeric;
  v_line_tax numeric;
  v_subtotal numeric := 0;
  v_item_discount_total numeric := 0;
  v_global_discount_total numeric := round(coalesce(p_global_discount_total, 0), 2);
  v_discount_total numeric;
  v_tax_total numeric := 0;
  v_total numeric := 0;
  v_pre_global_total numeric := 0;
  v_total_paid numeric;
  v_cash_paid numeric;
  v_non_cash_paid numeric;
  v_seq bigint;
  v_sale_number text;
  v_items_calculated jsonb := '[]'::jsonb;
  v_items_final jsonb := '[]'::jsonb;
  v_item_count integer;
  v_item_index integer := 0;
  v_allocated_global numeric := 0;
  v_approved_by uuid;
begin
  -- Los totales legacy se conservan en la firma por compatibilidad, pero el
  -- servidor recalcula precio, impuestos, descuentos y total desde productos.
  perform p_sale_number, p_subtotal, p_discount_total, p_tax_total, p_total;

  select id into v_sale_id
  from public.sales
  where idempotency_key = p_idempotency_key
    and tienda_id = p_tienda_id;

  if v_sale_id is not null then
    return v_sale_id;
  end if;

  if auth.uid() is null or auth.uid() <> p_cashier_id then
    raise exception 'No autenticado';
  end if;

  select rol into v_role
  from public.user_tiendas
  where user_id = auth.uid()
    and tienda_id = p_tienda_id
    and is_active = true;

  if v_role is null then
    raise exception 'Usuario sin acceso activo a la tienda';
  end if;

  if not exists (
    select 1 from public.cash_sessions
    where id = p_cash_session_id
      and tienda_id = p_tienda_id
      and status = 'open'
  ) then
    raise exception 'No hay caja abierta para esta venta';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  if v_global_discount_total < 0 then
    raise exception 'El descuento global no puede ser negativo';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_discount := round(coalesce((v_item->>'discount_amount')::numeric, 0), 2);

    if v_quantity <= 0 then
      raise exception 'La cantidad vendida debe ser mayor a cero';
    end if;

    select id, nombre, sku, tipo, is_active, precio_venta, iva_tasa
    into v_product
    from public.productos
    where id = (v_item->>'producto_id')::uuid
      and tienda_id = p_tienda_id;

    if v_product.id is null or not v_product.is_active then
      raise exception 'Producto no disponible';
    end if;

    if v_unit_discount < 0 or v_unit_discount > v_product.precio_venta then
      raise exception 'El descuento por producto no es válido';
    end if;

    if v_product.tipo <> 'prepared' then
      perform pg_advisory_xact_lock(hashtextextended(v_product.id::text || ':punto_venta', 0));
      select public.get_stock(v_product.id, p_tienda_id, 'punto_venta') into v_current_stock;
      if v_current_stock < v_quantity then
        raise exception 'Stock insuficiente';
      end if;
    end if;

    v_line_subtotal := round(v_product.precio_venta * v_quantity, 2);
    v_line_item_discount := round(v_unit_discount * v_quantity, 2);
    v_line_before_global := v_line_subtotal - v_line_item_discount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_item_discount_total := v_item_discount_total + v_line_item_discount;
    v_pre_global_total := v_pre_global_total + v_line_before_global;

    v_items_calculated := v_items_calculated || jsonb_build_array(jsonb_build_object(
      'producto_id', v_product.id,
      'producto_nombre', v_product.nombre,
      'producto_sku', v_product.sku,
      'tipo', v_product.tipo,
      'quantity', v_quantity,
      'unit_price', v_product.precio_venta,
      'discount_amount', v_unit_discount,
      'item_discount_total', v_line_item_discount,
      'tax_rate', v_product.iva_tasa,
      'line_before_global', v_line_before_global
    ));
  end loop;

  if v_global_discount_total > v_pre_global_total then
    raise exception 'El descuento global no puede superar el total disponible';
  end if;

  v_discount_total := v_item_discount_total + v_global_discount_total;

  if v_discount_total > 0 and length(btrim(coalesce(p_discount_reason, ''))) < 3 then
    raise exception 'El motivo del descuento es obligatorio';
  end if;

  if v_role = 'cajero' and v_discount_total > round(v_subtotal * 0.10, 2) then
    raise exception 'Descuentos mayores al 10%% requieren aprobación de admin';
  end if;

  if v_role = 'admin' and v_discount_total > round(v_subtotal * 0.10, 2) then
    v_approved_by := p_cashier_id;
  end if;

  v_item_count := jsonb_array_length(v_items_calculated);
  for v_item in select value from jsonb_array_elements(v_items_calculated)
  loop
    v_item_index := v_item_index + 1;
    v_line_before_global := (v_item->>'line_before_global')::numeric;

    if v_global_discount_total = 0 then
      v_line_global_discount := 0;
    elsif v_item_index = v_item_count then
      v_line_global_discount := least(
        v_line_before_global,
        greatest(0, v_global_discount_total - v_allocated_global)
      );
    else
      v_line_global_discount := least(
        v_line_before_global,
        greatest(
          0,
          round(
            v_global_discount_total * v_line_before_global / nullif(v_pre_global_total, 0),
            2
          )
        )
      );
      v_allocated_global := v_allocated_global + v_line_global_discount;
    end if;

    v_line_total := v_line_before_global - v_line_global_discount;
    if (v_item->>'tax_rate')::numeric = 0 then
      v_line_base := v_line_total;
    else
      v_line_base := round(v_line_total / (1 + (v_item->>'tax_rate')::numeric / 100), 2);
    end if;
    v_line_tax := v_line_total - v_line_base;

    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_line_total;
    v_items_final := v_items_final || jsonb_build_array(
      v_item || jsonb_build_object(
        'global_discount_amount', v_line_global_discount,
        'tax_amount', v_line_tax,
        'total', v_line_total
      )
    );
  end loop;

  select coalesce(sum((value->>'amount')::numeric), 0)
  into v_total_paid
  from jsonb_array_elements(p_payments);

  select coalesce(sum((value->>'amount')::numeric), 0)
  into v_cash_paid
  from jsonb_array_elements(p_payments)
  where value->>'metodo' = 'cash';

  v_non_cash_paid := v_total_paid - v_cash_paid;
  if v_total_paid < v_total then
    raise exception 'La suma de pagos no cubre el total de la venta';
  end if;
  if v_non_cash_paid > v_total or (v_total_paid - v_total) > v_cash_paid then
    raise exception 'El cambio solo puede generarse desde pagos en efectivo';
  end if;

  insert into public.sale_counters (tienda_id, last_number)
  values (p_tienda_id, 1)
  on conflict (tienda_id)
  do update set last_number = public.sale_counters.last_number + 1
  returning last_number into v_seq;

  v_sale_number := 'V-' || lpad(v_seq::text, 6, '0');

  insert into public.sales (
    tienda_id, cash_session_id, sale_number, cashier_id, cliente_id,
    subtotal, item_discount_total, global_discount_total, discount_total,
    discount_reason, discount_approved_by, tax_total, total, idempotency_key
  ) values (
    p_tienda_id, p_cash_session_id, v_sale_number, p_cashier_id, p_cliente_id,
    v_subtotal, v_item_discount_total, v_global_discount_total, v_discount_total,
    nullif(btrim(p_discount_reason), ''), v_approved_by, v_tax_total, v_total, p_idempotency_key
  ) returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(v_items_final)
  loop
    insert into public.sale_items (
      sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price,
      discount_amount, global_discount_amount, tax_rate, tax_amount, total
    ) values (
      v_sale_id,
      (v_item->>'producto_id')::uuid,
      v_item->>'producto_nombre',
      v_item->>'producto_sku',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'discount_amount')::numeric,
      (v_item->>'global_discount_amount')::numeric,
      (v_item->>'tax_rate')::numeric,
      (v_item->>'tax_amount')::numeric,
      (v_item->>'total')::numeric
    );
  end loop;

  for v_pay in select value from jsonb_array_elements(p_payments)
  loop
    insert into public.payments (sale_id, metodo, amount, referencia)
    values (
      v_sale_id,
      (v_pay->>'metodo')::public.payment_method,
      (v_pay->>'amount')::numeric,
      v_pay->>'referencia'
    );
  end loop;

  for v_item in select value from jsonb_array_elements(v_items_final)
  loop
    if v_item->>'tipo' <> 'prepared' then
      insert into public.inventory_movements (
        tienda_id, producto_id, tipo, cantidad, ubicacion, motivo,
        referencia_tipo, referencia_id, created_by
      ) values (
        p_tienda_id,
        (v_item->>'producto_id')::uuid,
        'sale_exit',
        -((v_item->>'quantity')::numeric),
        'punto_venta',
        'Venta ' || v_sale_number,
        'sale',
        v_sale_id,
        p_cashier_id
      );
    end if;
  end loop;

  return v_sale_id;
end;
$$;

comment on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb, numeric, text
) is
  'Crea la venta atómicamente. Recalcula precios, descuentos e IVA desde productos, prorratea el descuento global y aplica el umbral por rol.';

grant execute on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb, numeric, text
) to authenticated;

-- Compatibilidad para clientes desplegados antes de esta migración. El
-- descuento global se infiere del total recibido; las nuevas versiones deben
-- usar la firma extendida para enviar el motivo explícito.
create or replace function public.create_sale_atomic(
  p_tienda_id uuid,
  p_cash_session_id uuid,
  p_sale_number text,
  p_cashier_id uuid,
  p_cliente_id uuid,
  p_subtotal numeric,
  p_discount_total numeric,
  p_tax_total numeric,
  p_total numeric,
  p_idempotency_key text,
  p_items jsonb,
  p_payments jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item_discount_total numeric;
  v_inferred_global numeric;
begin
  select coalesce(sum(
    coalesce((value->>'discount_amount')::numeric, 0) *
    coalesce((value->>'quantity')::numeric, 0)
  ), 0)
  into v_item_discount_total
  from jsonb_array_elements(p_items);

  v_inferred_global := greatest(0, coalesce(p_discount_total, 0) - v_item_discount_total);

  return public.create_sale_atomic(
    p_tienda_id,
    p_cash_session_id,
    p_sale_number,
    p_cashier_id,
    p_cliente_id,
    p_subtotal,
    p_discount_total,
    p_tax_total,
    p_total,
    p_idempotency_key,
    p_items,
    p_payments,
    v_inferred_global,
    case when coalesce(p_discount_total, 0) > 0 then 'Cliente POS anterior' else null end
  );
end;
$$;

grant execute on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
) to authenticated;

create or replace function public.tg_audit_sale_discount()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.discount_total > 0 then
    insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, changes)
    values (
      new.tienda_id,
      new.cashier_id,
      'sale.discount_applied',
      'sale',
      new.id,
      jsonb_build_object(
        'sale_number', new.sale_number,
        'subtotal', new.subtotal,
        'item_discount_total', new.item_discount_total,
        'global_discount_total', new.global_discount_total,
        'discount_total', new.discount_total,
        'discount_percentage', round(new.discount_total * 100 / nullif(new.subtotal, 0), 2),
        'reason', new.discount_reason,
        'approved_by', new.discount_approved_by
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_audit_sale_discount on public.sales;
create trigger tr_audit_sale_discount
  after insert on public.sales
  for each row
  execute function public.tg_audit_sale_discount();

comment on column public.sales.item_discount_total is 'Suma de descuentos aplicados directamente a líneas de producto.';
comment on column public.sales.global_discount_total is 'Descuento general prorrateado entre las líneas de la venta.';
comment on column public.sales.discount_reason is 'Motivo operativo obligatorio cuando la venta tiene descuento.';
comment on column public.sales.discount_approved_by is 'Admin que autoriza un descuento superior al umbral; el admin puede autorizar su propia venta.';
comment on column public.sale_items.global_discount_amount is 'Parte del descuento global asignada a esta línea para reconciliar total e IVA.';
