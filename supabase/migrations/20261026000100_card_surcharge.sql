-- =====================================================
-- Recargo por pago con tarjeta vía Nequi Negocios (ADR 0024, PLAN-99)
-- =====================================================
-- El cliente asume la comisión de Nequi (1,99 % + 19 % de IVA sobre la
-- comisión) cuando paga con tarjeta, y a la cuenta llega exacto el valor de la
-- venta. El recargo se guarda APARTE del total de la venta y del monto de cada
-- pago: `sales.total` y `payments.amount` siguen siendo el valor de los
-- productos, así reportes, caja y paridad iOS no cambian.
--
-- 1. Columnas `card_surcharge` en payments y sales, más la tarifa usada
--    (snapshot) en sales.
-- 2. `card_fee_config(tienda)`: tarifa desde settings.data.pagoTarjeta
--    (por defecto 199 pb + 19 %), igual que `TiendaInfoService` en el web.
-- 3. `card_fee_amount` / `card_charge_for`: misma fórmula que
--    `features/sales/domain/services/card-surcharge.ts` (redondeo al peso,
--    mitades hacia arriba, IVA sobre la comisión redondeada — confirmado por el
--    dueño con la calculadora de Nequi el 2026-10-26). Paridad en
--    tests/integration/card-surcharge.parity.test.ts.
-- 4. `create_sale_atomic` (misma firma): recalcula el recargo de cada pago con
--    tarjeta, rechaza si no coincide con el que mostró el POS y valida los
--    límites de Nequi ($1.500 – $250.000 por cobro).
-- 5. `correct_payment_atomic`: no corrige pagos con recargo ni hacia tarjeta
--    (cambiaría lo cobrado por el datáfono).

-- 1. Columnas.
alter table public.payments
  add column if not exists card_surcharge numeric(12,2) not null default 0
    check (card_surcharge >= 0);

alter table public.sales
  add column if not exists card_surcharge numeric(12,2) not null default 0
    check (card_surcharge >= 0),
  add column if not exists card_fee_rate_bps int check (card_fee_rate_bps between 0 and 10000),
  add column if not exists card_fee_iva_pct int check (card_fee_iva_pct between 0 and 100);

comment on column public.payments.card_surcharge is
  'Recargo cobrado al cliente por pagar con tarjeta (ADR 0024). Va aparte de amount: por el datáfono pasó amount + card_surcharge.';
comment on column public.sales.card_surcharge is
  'Suma del recargo por tarjeta de los pagos de la venta (ADR 0024). No hace parte de total.';
comment on column public.sales.card_fee_rate_bps is
  'Comisión de la tarjeta en puntos básicos usada en la venta (snapshot). Null si no hubo pago con tarjeta.';
comment on column public.sales.card_fee_iva_pct is
  'IVA sobre la comisión de la tarjeta usado en la venta (snapshot). Null si no hubo pago con tarjeta.';

-- 2. Tarifa por tienda.
create or replace function public.card_fee_config(p_tienda_id uuid)
returns table (comision_bps int, iva_pct int)
language sql
stable
set search_path = public
as $$
  select
    least(10000, greatest(0, coalesce((s.data->'pagoTarjeta'->>'comisionBps')::int, 199))),
    least(100, greatest(0, coalesce((s.data->'pagoTarjeta'->>'ivaPct')::int, 19)))
  from (select 1) as one
  left join public.settings s on s.tienda_id = p_tienda_id;
$$;

revoke execute on function public.card_fee_config(uuid) from public, anon;
grant execute on function public.card_fee_config(uuid) to authenticated;

-- 3. Fórmula. `round(numeric)` redondea mitades alejándose de cero (= hacia
-- arriba en montos positivos) y la división por potencias de 10 es exacta.
create or replace function public.card_fee_amount(p_amount numeric, p_rate_bps int, p_iva_pct int)
returns numeric
language sql
immutable
set search_path = public
as $$
  select c.commission + round(c.commission * p_iva_pct / 100.0)
  from (select round(p_amount * p_rate_bps / 10000.0) as commission) as c;
$$;

-- Menor monto cuyo neto (monto − costo) cubre p_base. El costo nunca baja al
-- subir el monto, así que el neto sube a lo sumo $1 por peso y el primer monto
-- que cubre la base la cubre exacta. Arranca en una cota inferior segura (los
-- redondeos bajan el costo menos de $1,10).
create or replace function public.card_charge_for(p_base numeric, p_rate_bps int, p_iva_pct int)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric := round(greatest(p_base, 0));
  v_rate numeric := (p_rate_bps / 10000.0) * (1 + p_iva_pct / 100.0);
  v_charge numeric;
begin
  if v_base = 0 then
    return 0;
  end if;

  v_charge := greatest(v_base, floor((v_base - 2) / (1 - v_rate)) - 1);
  while v_charge - public.card_fee_amount(v_charge, p_rate_bps, p_iva_pct) < v_base loop
    v_charge := v_charge + 1;
  end loop;
  return v_charge;
end;
$$;

revoke execute on function public.card_fee_amount(numeric, int, int) from public, anon;
revoke execute on function public.card_charge_for(numeric, int, int) from public, anon;
grant execute on function public.card_fee_amount(numeric, int, int) to authenticated;
grant execute on function public.card_charge_for(numeric, int, int) to authenticated;

-- 4. Venta (cuerpo de 20261024000800 + bloque del recargo).
CREATE OR REPLACE FUNCTION public.create_sale_atomic(p_tienda_id uuid, p_cash_session_id uuid, p_sale_number text, p_cashier_id uuid, p_cliente_id uuid, p_subtotal numeric, p_discount_total numeric, p_tax_total numeric, p_total numeric, p_idempotency_key text, p_items jsonb, p_payments jsonb, p_global_discount_total numeric, p_discount_reason text, p_loyalty_redemptions jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Costo unitario capturado en la venta (ADR 0019).
  v_unit_cost numeric;
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
  -- Recargo por pago con tarjeta (ADR 0024).
  v_card_cfg record;
  v_card_charge numeric;
  v_card_surcharge numeric;
  v_card_surcharge_total numeric := 0;
  v_has_card boolean := false;
begin
  -- Los totales legacy se conservan en la firma por compatibilidad, pero el
  -- servidor recalcula precio, impuestos, descuentos y total desde productos.
  perform p_sale_number, p_subtotal, p_discount_total, p_tax_total, p_total;

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

  -- Reintento con la misma clave (respuesta perdida, doble clic): devuelve la
  -- venta ya registrada. Va DESPUÉS de validar identidad y tienda (antes un
  -- anónimo podía consultar ids por clave) y ANTES de exigir caja abierta
  -- (la caja pudo cerrarse entre el cobro y el reintento).
  select id into v_sale_id
  from public.sales
  where idempotency_key = p_idempotency_key
    and tienda_id = p_tienda_id;

  if v_sale_id is not null then
    return v_sale_id;
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

    select id, nombre, sku, tipo, is_active, precio_venta, iva_tasa, participa_fidelizacion, costo
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

    -- Costo unitario capturado en la venta (ADR 0019). Se congela aquí para que
    -- el margen histórico no cambie cuando cambie el costo del catálogo.
    --
    -- El combo se costea desde sus productos incluidos porque esa lista ES su
    -- lista completa de materiales. Un preparado no: sus componentes son el vaso
    -- y el sachet, pero la proteína base sale del tarro y no se mide por batido
    -- (ADR 0017), así que sumarlos daría un costo parcial disfrazado de total.
    if v_product.tipo = 'combo' then
      -- Si a cualquier producto incluido le falta costo, la línea queda sin
      -- costo: nunca se reporta un costo incompleto como si fuera completo.
      select case
               when bool_or(comp.costo is null) then null
               else sum(pc.cantidad * comp.costo)
             end
      into v_unit_cost
      from public.product_components pc
      join public.productos comp on comp.id = pc.componente_id
      where pc.producto_id = v_product.id
        and pc.tienda_id = p_tienda_id;
    else
      v_unit_cost := v_product.costo;
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
      'unit_cost', v_unit_cost,
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

  -- Recargo por tarjeta (ADR 0024): `amount` es la parte de la venta que cubre
  -- la tarjeta y `card_surcharge` lo que el cajero vio y pasó por el datáfono
  -- además. El servidor lo recalcula con la tarifa de la tienda y rechaza la
  -- venta si no coincide (la tarifa cambió con el cobro abierto o el cliente
  -- calculó distinto): nunca se guarda un recargo distinto al cobrado.
  select * into v_card_cfg from public.card_fee_config(p_tienda_id);

  for v_pay in select value from jsonb_array_elements(p_payments)
  loop
    v_pay_amount := (v_pay->>'amount')::numeric;

    if v_pay->>'metodo' = 'card' then
      v_has_card := true;
      if v_pay_amount <= 0 or v_pay_amount <> trunc(v_pay_amount) then
        raise exception 'El pago con tarjeta debe ser un valor entero en pesos';
      end if;

      v_card_charge := public.card_charge_for(v_pay_amount, v_card_cfg.comision_bps, v_card_cfg.iva_pct);
      v_card_surcharge := v_card_charge - v_pay_amount;

      if (v_pay->>'card_surcharge') is null
         or (v_pay->>'card_surcharge')::numeric <> v_card_surcharge then
        raise exception 'El recargo con tarjeta no coincide con la tarifa actual; vuelve a abrir el cobro';
      end if;

      if v_card_charge < 1500 or v_card_charge > 250000 then
        raise exception 'El cobro con tarjeta debe estar entre $1.500 y $250.000';
      end if;

      v_card_surcharge_total := v_card_surcharge_total + v_card_surcharge;
    elsif coalesce((v_pay->>'card_surcharge')::numeric, 0) <> 0 then
      raise exception 'Solo los pagos con tarjeta llevan recargo';
    end if;
  end loop;

  insert into public.sale_counters (tienda_id, last_number)
  values (p_tienda_id, 1)
  on conflict (tienda_id)
  do update set last_number = public.sale_counters.last_number + 1
  returning last_number into v_seq;

  v_sale_number := 'V-' || lpad(v_seq::text, 6, '0');

  insert into public.sales (
    tienda_id, cash_session_id, sale_number, cashier_id, cliente_id,
    subtotal, item_discount_total, global_discount_total, loyalty_discount_total, discount_total,
    discount_reason, discount_approved_by, tax_total, total, idempotency_key,
    card_surcharge, card_fee_rate_bps, card_fee_iva_pct
  ) values (
    p_tienda_id, p_cash_session_id, v_sale_number, p_cashier_id, p_cliente_id,
    v_subtotal, v_item_discount_total, v_global_discount_total, v_loyalty_total, v_discount_total,
    nullif(btrim(coalesce(v_discount_reason, '')), ''), v_approved_by, v_tax_total, v_total, p_idempotency_key,
    v_card_surcharge_total,
    case when v_has_card then v_card_cfg.comision_bps end,
    case when v_has_card then v_card_cfg.iva_pct end
  ) returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(v_items_final)
  loop
    insert into public.sale_items (
      sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price,
      unit_cost,
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
      (v_item->>'unit_cost')::numeric,
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

    insert into public.payments (sale_id, metodo, amount, referencia, card_surcharge)
    values (
      v_sale_id,
      (v_pay->>'metodo')::public.payment_method,
      v_pay_amount,
      v_pay->>'referencia',
      case
        when v_pay->>'metodo' = 'card'
          then public.card_charge_for(v_pay_amount, v_card_cfg.comision_bps, v_card_cfg.iva_pct) - v_pay_amount
        else 0
      end
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
exception
  -- Dos peticiones simultáneas con la misma clave: la segunda choca con
  -- sales_idempotency_key_key. Se devuelve la venta de la primera en vez del
  -- error crudo; cualquier otra violación de unicidad se relanza.
  when unique_violation then
    select id into v_sale_id
    from public.sales
    where idempotency_key = p_idempotency_key
      and tienda_id = p_tienda_id;
    if v_sale_id is null then
      raise;
    end if;
    return v_sale_id;
end;
$function$;

-- 5. Corrección de método de pago (cuerpo de 20260816000100 + guarda del recargo).
create or replace function public.correct_payment_atomic(
  p_payment_id   uuid,
  p_tienda_id    uuid,
  p_new_metodo   public.payment_method,
  p_corrected_by uuid,
  p_reason       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_metodo  public.payment_method;
  v_sale_id     uuid;
  v_sale_number text;
  v_session_id  uuid;
  v_surcharge   numeric;
begin
  if auth.uid() is null or auth.uid() <> p_corrected_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'No tienes acceso a esta tienda';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'El motivo debe tener al menos 10 caracteres';
  end if;

  select
    pay.metodo,
    s.id,
    s.sale_number,
    s.cash_session_id,
    pay.card_surcharge
  into
    v_old_metodo,
    v_sale_id,
    v_sale_number,
    v_session_id,
    v_surcharge
  from public.payments pay
  join public.sales s on s.id = pay.sale_id
  where pay.id = p_payment_id
    and s.tienda_id = p_tienda_id
    and s.status = 'completed';

  if v_sale_id is null then
    raise exception 'Pago no encontrado o la venta ya fue anulada';
  end if;

  if not exists (
    select 1
    from public.cash_sessions
    where id = v_session_id
      and status = 'open'
  ) then
    raise exception 'Solo se puede corregir el pago mientras la sesión de caja esté abierta';
  end if;

  -- ADR 0024: un pago con recargo ya pasó por el datáfono (monto + recargo) y
  -- uno nuevo con tarjeta necesitaría recargo; corregir el método cambiaría lo
  -- cobrado. Se anula la venta y se registra de nuevo.
  if p_new_metodo <> v_old_metodo
     and (coalesce(v_surcharge, 0) > 0 or p_new_metodo = 'card') then
    raise exception 'Los pagos con tarjeta no se corrigen: anula la venta y regístrala de nuevo';
  end if;

  update public.payments
  set metodo = p_new_metodo
  where id = p_payment_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, changes)
  values (
    p_tienda_id,
    p_corrected_by,
    'sale.payment_corrected',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'old_metodo',   v_old_metodo,
      'new_metodo',   p_new_metodo,
      'reason',       btrim(p_reason),
      'sale_id',      v_sale_id,
      'sale_number',  v_sale_number
    )
  );
end;
$$;

comment on function public.correct_payment_atomic(uuid, uuid, public.payment_method, uuid, text) is
  'Corrige el método de pago de un registro en payments. Cualquier usuario activo en la tienda (admin o cajero), solo con sesión de caja abierta. Registra en audit_logs. El amount nunca se modifica.';
