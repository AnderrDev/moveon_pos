-- =====================================================
-- Soporte de combos en la venta y el inventario (PLAN-73 / ADR 0018)
-- =====================================================
-- Un combo (`productos.tipo = 'combo'`) se comporta igual que un batido
-- (`prepared`) para efectos de inventario: no descuenta stock de sí mismo, sino
-- de los productos que lo componen (`product_components`). La diferencia es
-- semántica y de precio: el combo tiene su propio `precio_venta` fijo y va como
-- UNA sola línea en el ticket.
--
-- Cambios:
--   1. `create_sale_atomic`            — el combo no valida ni descuenta stock propio.
--   2. `tg_consume_sale_components`    — el trigger también corre para combos.
--   3. `void_sale_atomic`              — devuelve los componentes al anular (ver nota).
--   4. `create_product_with_initial_stock` — rechaza inventario inicial en combos.
--   5. `storefront_productos_publicos` — los combos no salen al catálogo público.
--
-- Nota sobre la anulación: hasta hoy anular una venta NO devolvía los
-- componentes al stock (deuda conocida, ADR 0017 §Consecuencias). Con batidos el
-- faltante era un vaso; con combos sería una proteína completa. Esta migración
-- cierra la deuda para ambos: componentes fijos y componente de la opción.

-- =====================================================
-- 1. create_sale_atomic
-- =====================================================
-- Cuerpo idéntico a 20260802143900_product_options.sql salvo los dos guardas de
-- inventario, que pasan de `<> 'prepared'` a `not in ('prepared','combo')`.

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
  p_payments jsonb,
  p_global_discount_total numeric,
  p_discount_reason text,
  p_loyalty_redemptions jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_pay jsonb;
  v_product record;
  v_role public.user_role;
  v_current_stock numeric;
  v_quantity numeric;
  v_unit_discount numeric;
  -- Opción elegida en la venta (ADR 0017): precio efectivo y snapshots.
  v_unit_price numeric;
  v_option_id uuid;
  v_option_nombre text;
  v_option_extra numeric;
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
  v_change_remaining numeric;
  v_pay_amount numeric;
  v_pay_reduction numeric;
  v_seq bigint;
  v_sale_number text;
  v_items_calculated jsonb := '[]'::jsonb;
  v_items_final jsonb := '[]'::jsonb;
  v_item_count integer;
  v_item_index integer := 0;
  v_allocated_global numeric := 0;
  v_approved_by uuid;
  -- MOVE ON Club
  v_redemptions jsonb := coalesce(p_loyalty_redemptions, '[]'::jsonb);
  v_red jsonb;
  v_reward record;
  v_cliente record;
  v_cfg record;
  v_loop_index integer := -1;
  v_line_loyalty numeric;
  v_line_reward_id uuid;
  v_loyalty_total numeric := 0;
  v_discount_reason text := p_discount_reason;
  v_stamps int := 0;
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

  if jsonb_typeof(v_redemptions) <> 'array' then
    raise exception 'Formato de canje inválido';
  end if;

  if jsonb_array_length(v_redemptions) > 0 and p_cliente_id is null then
    raise exception 'El canje de recompensa requiere un cliente asociado';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_loop_index := v_loop_index + 1;
    v_quantity := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_discount := round(coalesce((v_item->>'discount_amount')::numeric, 0), 2);

    if v_quantity <= 0 then
      raise exception 'La cantidad vendida debe ser mayor a cero';
    end if;

    select id, nombre, sku, tipo, is_active, precio_venta, iva_tasa, participa_fidelizacion
    into v_product
    from public.productos
    where id = (v_item->>'producto_id')::uuid
      and tienda_id = p_tienda_id;

    if v_product.id is null or not v_product.is_active then
      raise exception 'Producto no disponible';
    end if;

    -- Opción elegida (ej. tipo de proteína del batido). El recargo lo pone el
    -- servidor, nunca el cliente. Si el producto tiene opciones activas y no
    -- llega ninguna, se aplica la marcada por defecto (ADR 0017 §2.3).
    v_option_id := nullif(v_item->>'option_id', '')::uuid;
    v_option_nombre := null;
    v_option_extra := null;

    if v_option_id is not null then
      select po.nombre, po.precio_extra
      into v_option_nombre, v_option_extra
      from public.product_options po
      where po.id = v_option_id
        and po.producto_id = v_product.id
        and po.tienda_id = p_tienda_id
        and po.is_active;

      if v_option_nombre is null then
        raise exception 'La opción elegida no es válida para el producto';
      end if;
    else
      select po.id, po.nombre, po.precio_extra
      into v_option_id, v_option_nombre, v_option_extra
      from public.product_options po
      where po.producto_id = v_product.id
        and po.tienda_id = p_tienda_id
        and po.is_active
        and po.es_default
      limit 1;
    end if;

    v_option_extra := round(coalesce(v_option_extra, 0), 2);
    v_unit_price := round(v_product.precio_venta + v_option_extra, 2);

    if v_unit_discount < 0 or v_unit_discount > v_unit_price then
      raise exception 'El descuento por producto no es válido';
    end if;

    -- Ni los preparados ni los combos rastrean stock propio: lo que se descuenta
    -- son sus componentes, y esos son política "advertir, no bloquear"
    -- (el trigger tg_consume_sale_components los mueve después del insert).
    if v_product.tipo not in ('prepared', 'combo') then
      perform pg_advisory_xact_lock(hashtextextended(v_product.id::text || ':punto_venta', 0));
      select public.get_stock(v_product.id, p_tienda_id, 'punto_venta') into v_current_stock;
      if v_current_stock < v_quantity then
        raise exception 'Stock insuficiente';
      end if;
    end if;

    -- Canje MOVE ON Club dirigido a esta línea (máximo una recompensa por línea).
    v_line_loyalty := 0;
    v_line_reward_id := null;

    for v_red in
      select value from jsonb_array_elements(v_redemptions)
      where (value->>'item_index')::int = v_loop_index
    loop
      if v_line_reward_id is not null then
        raise exception 'Solo se puede canjear una recompensa por línea';
      end if;

      if not v_product.participa_fidelizacion then
        raise exception 'El producto no participa en MOVE ON Club';
      end if;

      if v_unit_discount > 0 then
        raise exception 'La línea canjeada no puede tener descuento manual';
      end if;

      select id, cliente_id, reward_value_cop, status, expires_at
      into v_reward
      from public.loyalty_rewards
      where id = (v_red->>'reward_id')::uuid
        and tienda_id = p_tienda_id
      for update;

      if v_reward.id is null or v_reward.cliente_id <> p_cliente_id then
        raise exception 'Recompensa no encontrada para este cliente';
      end if;

      if v_reward.status <> 'available' then
        raise exception 'La recompensa ya fue utilizada o anulada';
      end if;

      if v_reward.expires_at <= now() then
        raise exception 'La recompensa está vencida';
      end if;

      -- RN-LF08: batido base gratis hasta el valor de la recompensa; si el
      -- batido cuesta más, el cliente paga la diferencia.
      v_line_loyalty := round(least(v_unit_price, v_reward.reward_value_cop), 2);
      v_line_reward_id := v_reward.id;
      v_loyalty_total := v_loyalty_total + v_line_loyalty;
    end loop;

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_line_item_discount := round(v_unit_discount * v_quantity, 2);
    v_line_before_global := v_line_subtotal - v_line_item_discount - v_line_loyalty;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_item_discount_total := v_item_discount_total + v_line_item_discount;
    v_pre_global_total := v_pre_global_total + v_line_before_global;

    v_items_calculated := v_items_calculated || jsonb_build_array(jsonb_build_object(
      'producto_id', v_product.id,
      'producto_nombre', v_product.nombre,
      'producto_sku', v_product.sku,
      'tipo', v_product.tipo,
      'quantity', v_quantity,
      'unit_price', v_unit_price,
      'option_id', v_option_id,
      'option_nombre', v_option_nombre,
      'option_extra', v_option_extra,
      'discount_amount', v_unit_discount,
      'item_discount_total', v_line_item_discount,
      'tax_rate', v_product.iva_tasa,
      'line_before_global', v_line_before_global,
      'participa_fidelizacion', v_product.participa_fidelizacion,
      'loyalty_discount', v_line_loyalty,
      'loyalty_reward_id', v_line_reward_id
    ));
  end loop;

  if v_global_discount_total > v_pre_global_total then
    raise exception 'El descuento global no puede superar el total disponible';
  end if;

  v_discount_total := v_item_discount_total + v_global_discount_total + v_loyalty_total;

  -- El motivo solo es obligatorio para el descuento discrecional; el canje de
  -- recompensa lleva un motivo reservado automático (ADR 0013 §5).
  if (v_item_discount_total + v_global_discount_total) > 0
     and length(btrim(coalesce(v_discount_reason, ''))) < 3 then
    raise exception 'El motivo del descuento es obligatorio';
  end if;

  if v_discount_total > 0 and length(btrim(coalesce(v_discount_reason, ''))) < 3 then
    v_discount_reason := 'Canje MOVE ON Club';
  end if;

  -- RN-S09 (rev. 2026-08-02): sin tope por rol — el descuento discrecional
  -- puede llegar al 100% del subtotal y dejar la venta en $0. El límite lo
  -- imponen las validaciones de arriba (descuento de línea <= precio de venta,
  -- descuento global <= total disponible), no el rol.
  --
  -- Traza de auditoría: un descuento discrecional mayor al 50% hecho por un
  -- admin queda firmado en `discount_approved_by`. El canje de recompensa no es
  -- un descuento manual y queda excluido del cálculo (RN-LF12 / ADR 0013 §5).
  if v_role = 'admin'
     and (v_discount_total - v_loyalty_total) > round(v_subtotal * 0.50, 2) then
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

    -- Sellos: unidades elegibles = cantidad entera de líneas participantes sin
    -- descuento de línea ni global prorrateado; la unidad canjeada no cuenta
    -- (RN-LF01/02/05).
    if (v_item->>'participa_fidelizacion')::boolean
       and (v_item->>'discount_amount')::numeric = 0
       and v_line_global_discount = 0 then
      v_stamps := v_stamps + greatest(
        0,
        floor((v_item->>'quantity')::numeric)::int
          - case when v_item->>'loyalty_reward_id' is not null then 1 else 0 end
      );
    end if;

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
    subtotal, item_discount_total, global_discount_total, loyalty_discount_total, discount_total,
    discount_reason, discount_approved_by, tax_total, total, idempotency_key
  ) values (
    p_tienda_id, p_cash_session_id, v_sale_number, p_cashier_id, p_cliente_id,
    v_subtotal, v_item_discount_total, v_global_discount_total, v_loyalty_total, v_discount_total,
    nullif(btrim(coalesce(v_discount_reason, '')), ''), v_approved_by, v_tax_total, v_total, p_idempotency_key
  ) returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(v_items_final)
  loop
    insert into public.sale_items (
      sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price,
      option_id, option_nombre, option_extra,
      discount_amount, global_discount_amount, loyalty_discount_amount, loyalty_reward_id,
      tax_rate, tax_amount, total
    ) values (
      v_sale_id,
      (v_item->>'producto_id')::uuid,
      v_item->>'producto_nombre',
      v_item->>'producto_sku',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'option_id')::uuid,
      v_item->>'option_nombre',
      coalesce((v_item->>'option_extra')::numeric, 0),
      (v_item->>'discount_amount')::numeric,
      (v_item->>'global_discount_amount')::numeric,
      (v_item->>'loyalty_discount')::numeric,
      (v_item->>'loyalty_reward_id')::uuid,
      (v_item->>'tax_rate')::numeric,
      (v_item->>'tax_amount')::numeric,
      (v_item->>'total')::numeric
    );

    -- Marca la recompensa como redimida (RN-LF10): atómico con la venta.
    if v_item->>'loyalty_reward_id' is not null then
      update public.loyalty_rewards
      set status = 'redeemed',
          redeemed_at = now(),
          redeemed_sale_id = v_sale_id,
          redeemed_by = p_cashier_id
      where id = (v_item->>'loyalty_reward_id')::uuid
        and status = 'available';

      if not found then
        raise exception 'La recompensa ya fue utilizada o anulada';
      end if;

      update public.loyalty_accounts
      set total_rewards_redeemed = total_rewards_redeemed + 1
      where tienda_id = p_tienda_id and cliente_id = p_cliente_id;
    end if;
  end loop;

  -- El vuelto (total pagado - total de la venta) se descuenta de los pagos en
  -- efectivo antes de persistir: `payments.amount` siempre debe sumar
  -- exactamente `v_total` para una venta completada, nunca el monto bruto
  -- recibido del cliente.
  v_change_remaining := greatest(0, v_total_paid - v_total);

  for v_pay in select value from jsonb_array_elements(p_payments)
  loop
    v_pay_amount := (v_pay->>'amount')::numeric;

    if v_pay->>'metodo' = 'cash' and v_change_remaining > 0 then
      v_pay_reduction := least(v_pay_amount, v_change_remaining);
      v_pay_amount := v_pay_amount - v_pay_reduction;
      v_change_remaining := v_change_remaining - v_pay_reduction;
    end if;

    insert into public.payments (sale_id, metodo, amount, referencia)
    values (
      v_sale_id,
      (v_pay->>'metodo')::public.payment_method,
      v_pay_amount,
      v_pay->>'referencia'
    );
  end loop;

  for v_item in select value from jsonb_array_elements(v_items_final)
  loop
    if v_item->>'tipo' not in ('prepared', 'combo') then
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

  -- MOVE ON Club: otorga sellos en la MISMA transacción de la venta (RN-LF03).
  -- Requiere programa activo y cliente activo que autorizó participar.
  if p_cliente_id is not null and v_stamps > 0 then
    select activo, autoriza_fidelizacion into v_cliente
    from public.clientes
    where id = p_cliente_id and tienda_id = p_tienda_id;

    select * into v_cfg from public.loyalty_program_config(p_tienda_id);

    if v_cfg.activo
       and coalesce(v_cliente.activo, false)
       and coalesce(v_cliente.autoriza_fidelizacion, false) then
      perform public.loyalty_apply_delta(
        p_tienda_id, p_cliente_id, 'earn', v_stamps,
        v_sale_id, 'Venta ' || v_sale_number, p_cashier_id
      );
      perform public.loyalty_generate_rewards(p_tienda_id, p_cliente_id, v_sale_id, p_cashier_id);
    end if;
  end if;

  return v_sale_id;
end;
$function$;

grant execute on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb, numeric, text, jsonb
) to authenticated;

-- =====================================================
-- 2. tg_consume_sale_components
-- =====================================================
-- Cuerpo idéntico a 20260802143900_product_options.sql salvo el guarda inicial:
-- ahora corre para preparados Y combos. Política sin cambios: el stock puede
-- quedar negativo (advertir, no bloquear).

create or replace function public.tg_consume_sale_components()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tienda_id     uuid;
  v_cashier_id    uuid;
  v_sale_number   text;
  v_producto_tipo text;
  v_component     record;
  v_option        record;
begin
  select s.tienda_id, s.cashier_id, s.sale_number, p.tipo
  into   v_tienda_id, v_cashier_id, v_sale_number, v_producto_tipo
  from   public.sales     s
  join   public.productos p on p.id = new.producto_id
  where  s.id = new.sale_id;

  -- Aplica a los productos que no rastrean stock propio: preparados y combos.
  if v_producto_tipo not in ('prepared', 'combo') then
    return new;
  end if;

  for v_component in
    select componente_id, cantidad
    from   public.product_components
    where  producto_id = new.producto_id
      and  tienda_id   = v_tienda_id
  loop
    insert into public.inventory_movements (
      tienda_id, producto_id, tipo, cantidad, ubicacion,
      motivo, referencia_tipo, referencia_id, created_by
    ) values (
      v_tienda_id,
      v_component.componente_id,
      'sale_exit',
      -(v_component.cantidad * new.quantity),
      'punto_venta',
      'Comp. ' || v_sale_number,
      'sale',
      new.sale_id,
      v_cashier_id
    );
  end loop;

  -- Componente de la opción elegida (ej. sachet de Bipro). ADR 0017 §2.4.
  if new.option_id is not null then
    select componente_id, componente_cantidad, nombre
    into   v_option
    from   public.product_options
    where  id = new.option_id
      and  tienda_id = v_tienda_id;

    if v_option.componente_id is not null and v_option.componente_cantidad > 0 then
      insert into public.inventory_movements (
        tienda_id, producto_id, tipo, cantidad, ubicacion,
        motivo, referencia_tipo, referencia_id, created_by
      ) values (
        v_tienda_id,
        v_option.componente_id,
        'sale_exit',
        -(v_option.componente_cantidad * new.quantity),
        'punto_venta',
        v_option.nombre || ' ' || v_sale_number,
        'sale',
        new.sale_id,
        v_cashier_id
      );
    end if;
  end if;

  return new;
end;
$$;

-- =====================================================
-- 3. void_sale_atomic
-- =====================================================
-- Cuerpo idéntico a 20260714225231_loyalty_move_on_club.sql más:
--   * el guarda de la devolución directa pasa a `not in ('prepared','combo')`;
--   * se devuelven los componentes consumidos (fijos y de la opción), cerrando
--     la deuda documentada en ADR 0017 §Consecuencias.
-- No hay doble devolución posible: el batido/combo en sí nunca generó `sale_exit`.

create or replace function public.void_sale_atomic(
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
  v_cliente_id uuid;
  v_reward record;
  v_earned int;
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
  returning id, cliente_id into v_sale_id, v_cliente_id;

  if v_sale_id is null then
    raise exception 'Venta no encontrada o ya anulada';
  end if;

  -- Productos que sí rastrean stock propio: vuelve la unidad vendida.
  insert into inventory_movements (
    tienda_id, producto_id, tipo, cantidad,
    ubicacion, referencia_tipo, referencia_id, created_by, motivo
  )
  select
    p_tienda_id,
    si.producto_id,
    'void_return',
    si.quantity,
    'punto_venta',
    'sale',
    p_sale_id,
    p_voided_by,
    p_voided_reason
  from sale_items si
  join productos p on p.id = si.producto_id
  where si.sale_id = p_sale_id
    and p.tipo not in ('prepared', 'combo');

  -- Preparados y combos: vuelven los componentes que consumió la venta.
  insert into inventory_movements (
    tienda_id, producto_id, tipo, cantidad,
    ubicacion, referencia_tipo, referencia_id, created_by, motivo
  )
  select
    p_tienda_id,
    pc.componente_id,
    'void_return',
    pc.cantidad * si.quantity,
    'punto_venta',
    'sale',
    p_sale_id,
    p_voided_by,
    p_voided_reason
  from sale_items si
  join productos p on p.id = si.producto_id
  join product_components pc
    on pc.producto_id = si.producto_id
   and pc.tienda_id = p_tienda_id
  where si.sale_id = p_sale_id
    and p.tipo in ('prepared', 'combo');

  -- Componente de la opción elegida en la venta (ej. sachet de Bipro).
  insert into inventory_movements (
    tienda_id, producto_id, tipo, cantidad,
    ubicacion, referencia_tipo, referencia_id, created_by, motivo
  )
  select
    p_tienda_id,
    po.componente_id,
    'void_return',
    po.componente_cantidad * si.quantity,
    'punto_venta',
    'sale',
    p_sale_id,
    p_voided_by,
    p_voided_reason
  from sale_items si
  join productos p on p.id = si.producto_id
  join product_options po
    on po.id = si.option_id
   and po.tienda_id = p_tienda_id
  where si.sale_id = p_sale_id
    and p.tipo in ('prepared', 'combo')
    and po.componente_id is not null
    and po.componente_cantidad > 0;

  -- ===== MOVE ON Club: reversa de fidelización =====
  if v_cliente_id is not null then
    -- 1. Recompensas canjeadas EN esta venta vuelven a estar disponibles
    --    (o quedan vencidas si ya pasó su vigencia).
    update loyalty_rewards
    set status = case when expires_at > now() then 'available' else 'expired' end::public.loyalty_reward_status,
        redeemed_at = null,
        redeemed_sale_id = null,
        redeemed_by = null
    where redeemed_sale_id = p_sale_id
      and status = 'redeemed';

    if found then
      update loyalty_accounts
      set total_rewards_redeemed = greatest(0, total_rewards_redeemed - 1)
      where tienda_id = p_tienda_id and cliente_id = v_cliente_id;
    end if;

    -- 2. Recompensas generadas POR esta venta que sigan disponibles se anulan
    --    y devuelven los sellos que consumieron al generarse.
    for v_reward in
      select r.id, r.cliente_id, r.cost_stamps
      from loyalty_rewards r
      where r.status = 'available'
        and r.source_transaction_id in (
          select id from loyalty_transactions
          where sale_id = p_sale_id and type = 'redeem'
        )
    loop
      update loyalty_rewards
      set status = 'voided',
          voided_at = now(),
          voided_by = p_voided_by,
          voided_reason = 'Venta anulada: ' || p_voided_reason
      where id = v_reward.id;

      perform loyalty_apply_delta(
        p_tienda_id, v_reward.cliente_id, 'void', v_reward.cost_stamps,
        p_sale_id, 'Reversa de recompensa generada por venta anulada', p_voided_by
      );
    end loop;

    -- 3. Reversa de los sellos ganados por esta venta (truncando en 0 si ya se
    --    consumieron en una recompensa redimida — la anulación nunca se bloquea).
    select coalesce(sum(stamps_delta), 0) into v_earned
    from loyalty_transactions
    where sale_id = p_sale_id and type = 'earn';

    if v_earned > 0 then
      perform loyalty_apply_delta(
        p_tienda_id, v_cliente_id, 'void', -v_earned,
        p_sale_id, 'Reversa de sellos por venta anulada', p_voided_by, true
      );
    end if;
  end if;

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

grant execute on function public.void_sale_atomic(uuid, uuid, uuid, text) to authenticated;

-- =====================================================
-- 4. create_product_with_initial_stock
-- =====================================================
-- Solo cambia el guarda del inventario inicial: los combos tampoco lo controlan.

create or replace function public.create_product_with_initial_stock(
  p_tienda_id uuid,
  p_nombre text,
  p_sku text,
  p_codigo_barras text,
  p_categoria_id uuid,
  p_para_que_sirve text,
  p_recomendado_para text,
  p_tipo public.product_type,
  p_unidad text,
  p_precio_venta numeric,
  p_costo numeric,
  p_iva_tasa numeric,
  p_stock_minimo numeric,
  p_is_active boolean,
  p_initial_stock numeric,
  p_initial_location public.inventory_location,
  p_proveedor text default null,
  p_image_url text default null,
  p_participa_fidelizacion boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_product_id uuid;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_user_id
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo un administrador puede crear productos con inventario inicial';
  end if;

  if coalesce(p_initial_stock, 0) < 0 then
    raise exception 'El inventario inicial no puede ser negativo';
  end if;

  if p_tipo in ('prepared', 'combo') and coalesce(p_initial_stock, 0) > 0 then
    raise exception 'Los productos preparados y los combos no controlan inventario propio';
  end if;

  if p_categoria_id is not null and not exists (
    select 1
    from public.categorias
    where id = p_categoria_id
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'La categoría no pertenece a la tienda';
  end if;

  insert into public.productos (
    tienda_id, nombre, sku, codigo_barras, categoria_id,
    para_que_sirve, recomendado_para, tipo, unidad,
    precio_venta, costo, iva_tasa, stock_minimo, is_active, proveedor, image_url,
    participa_fidelizacion
  ) values (
    p_tienda_id, btrim(p_nombre), nullif(btrim(p_sku), ''),
    nullif(btrim(p_codigo_barras), ''), p_categoria_id,
    nullif(btrim(p_para_que_sirve), ''), nullif(btrim(p_recomendado_para), ''),
    p_tipo, btrim(p_unidad), p_precio_venta, p_costo,
    p_iva_tasa, p_stock_minimo, p_is_active, nullif(btrim(p_proveedor), ''),
    nullif(btrim(p_image_url), ''),
    coalesce(p_participa_fidelizacion, false)
  )
  returning id into v_product_id;

  if coalesce(p_initial_stock, 0) > 0 then
    insert into public.inventory_movements (
      tienda_id, producto_id, tipo, ubicacion, cantidad,
      costo_unitario, motivo, referencia_tipo, referencia_id, created_by
    ) values (
      p_tienda_id, v_product_id, 'entry', p_initial_location, p_initial_stock,
      p_costo, 'Inventario inicial al crear producto',
      'product_initial_stock', v_product_id, v_user_id
    );
  end if;

  return v_product_id;
end;
$$;

revoke execute on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location, text, text, boolean
) from public, anon;

grant execute on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location, text, text, boolean
) to authenticated;

-- =====================================================
-- 5. storefront_productos_publicos
-- =====================================================
-- Los combos se venden solo en el POS (decisión del dueño, 2026-08-03). Se usa
-- `create or replace` para conservar los grants de 20260716000200.

create or replace view public.storefront_productos_publicos as
select
  p.id,
  p.nombre,
  p.tipo,
  p.para_que_sirve,
  p.image_url,
  p.marca,
  p.etiqueta,
  p.categoria_id,
  c.nombre as categoria_nombre,
  c.orden as categoria_orden
from public.productos p
left join public.categorias c
  on c.id = p.categoria_id
 and c.is_active = true
where p.is_active = true
  and p.deleted_at is null
  and p.tipo not in ('ingredient', 'combo');

comment on view public.storefront_productos_publicos is
  'Vista pública del catálogo de suplementos. No expone precio_venta, costo, SKU ni códigos internos. Excluye ingredientes y combos (los combos se venden solo en el POS).';

comment on table public.product_components is
  'Productos consumidos al vender un producto sin stock propio: los componentes de un preparado (ej. vaso del batido) y los productos incluidos en un combo. Genera movimientos de salida por cada uno. Stock puede quedar negativo.';

comment on column public.product_components.cantidad is
  'Unidades del componente consumidas por cada unidad vendida del preparado o combo.';
