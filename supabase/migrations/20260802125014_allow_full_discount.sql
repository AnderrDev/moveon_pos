-- Permite descuentos de hasta el 100% del subtotal (venta en $0).
--
-- Decisión de negocio del dueño (2026-08-02): el tope del 50% para el cajero
-- (subido de 10% a 50% el 2026-06-23) sigue estorbando la operación —
-- cortesías, reposiciones y promociones puntuales dejan la venta en $0 y el
-- RPC las rechazaba. Se elimina el tope por rol; el límite que queda es
-- estructural y ya lo imponen las validaciones existentes:
--   * el descuento por línea no puede superar el precio de venta;
--   * el descuento global no puede superar el total disponible.
-- Es decir, el descuento nunca puede pasar del 100% del subtotal.
--
-- Se conserva la traza: un descuento discrecional mayor al 50% hecho por un
-- admin sigue marcando `discount_approved_by`, y todo descuento sigue
-- exigiendo motivo (`discount_reason`) para el reporte de control.
--
-- Cuerpo idéntico a la versión vigente (20260714225231_loyalty_move_on_club.sql)
-- salvo el bloque del tope de descuento.

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
      v_line_loyalty := round(least(v_product.precio_venta, v_reward.reward_value_cop), 2);
      v_line_reward_id := v_reward.id;
      v_loyalty_total := v_loyalty_total + v_line_loyalty;
    end loop;

    v_line_subtotal := round(v_product.precio_venta * v_quantity, 2);
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
      'unit_price', v_product.precio_venta,
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
      discount_amount, global_discount_amount, loyalty_discount_amount, loyalty_reward_id,
      tax_rate, tax_amount, total
    ) values (
      v_sale_id,
      (v_item->>'producto_id')::uuid,
      v_item->>'producto_nombre',
      v_item->>'producto_sku',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
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
