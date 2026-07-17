-- ============================================================
-- MIGRACIÓN — MOVE ON Club (programa de fidelización, PLAN-50/52/53/56/58)
-- Ver docs/adr/0013-programa-fidelizacion-move-on-club.md y docs/modules/loyalty.md
--
-- Diseño: ledger append-only (loyalty_transactions) + proyección cacheada
-- (loyalty_accounts). RLS solo-SELECT: toda mutación pasa por RPC
-- SECURITY DEFINER. La redención es un descuento dirigido excluido del tope
-- de descuento discrecional RN-S09 (ADR 0013 §5).
-- ============================================================

-- ==================== 1. CLIENTES: identidad por celular ====================

alter table public.clientes
  add column if not exists celular_normalizado text,
  add column if not exists activo boolean not null default true,
  add column if not exists autoriza_fidelizacion boolean not null default false,
  add column if not exists acepta_mensajes_promocionales boolean not null default false;

-- Celular canónico colombiano (10 dígitos, sin +57): único por tienda.
create unique index if not exists ux_clientes_celular_normalizado
  on public.clientes (tienda_id, celular_normalizado)
  where celular_normalizado is not null;

comment on column public.clientes.celular_normalizado is
  'Celular colombiano canónico (10 dígitos, sin prefijo 57). Identificador operativo principal del cliente. Normalizado por el value object PhoneCO del dominio.';

-- Backfill: normaliza los teléfonos existentes que ya sean un celular colombiano
-- válido (10 dígitos empezando por 3, con o sin prefijo 57). Colisiones dentro
-- de la misma tienda: solo el cliente más antiguo recibe el valor.
with candidates as (
  select id, tienda_id,
         case
           when regexp_replace(coalesce(telefono, ''), '\D', '', 'g') ~ '^3\d{9}$'
             then regexp_replace(telefono, '\D', '', 'g')
           when regexp_replace(coalesce(telefono, ''), '\D', '', 'g') ~ '^57(3\d{9})$'
             then substring(regexp_replace(telefono, '\D', '', 'g') from 3)
           else null
         end as normalizado,
         created_at
  from public.clientes
  where celular_normalizado is null
), ranked as (
  select id, normalizado,
         row_number() over (partition by tienda_id, normalizado order by created_at) as rn
  from candidates
  where normalizado is not null
)
update public.clientes c
set celular_normalizado = r.normalizado
from ranked r
where c.id = r.id and r.rn = 1;

-- ==================== 2. PRODUCTOS: elegibilidad explícita ====================

alter table public.productos
  add column if not exists participa_fidelizacion boolean not null default false;

comment on column public.productos.participa_fidelizacion is
  'MOVE ON Club: el admin marca explícitamente qué productos (batidos) generan sellos y pueden canjearse. No se infiere de tipo = prepared (RN-LF06).';

-- ==================== 3. TABLAS DE FIDELIZACIÓN ====================

do $$ begin
  create type public.loyalty_transaction_type as enum ('earn', 'redeem', 'void', 'adjustment', 'expire');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_reward_status as enum ('available', 'redeemed', 'expired', 'voided');
exception when duplicate_object then null; end $$;

create table if not exists public.loyalty_accounts (
  id                     uuid        primary key default gen_random_uuid(),
  tienda_id              uuid        not null references public.tiendas(id) on delete cascade,
  cliente_id             uuid        not null references public.clientes(id) on delete cascade,
  stamps_balance         int         not null default 0 check (stamps_balance >= 0),
  total_stamps_earned    int         not null default 0,
  total_rewards_redeemed int         not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tienda_id, cliente_id)
);

create trigger loyalty_accounts_updated_at before update on public.loyalty_accounts
  for each row execute function public.update_updated_at();

create table if not exists public.loyalty_transactions (
  id            uuid                            primary key default gen_random_uuid(),
  tienda_id     uuid                            not null references public.tiendas(id) on delete cascade,
  cliente_id    uuid                            not null references public.clientes(id) on delete cascade,
  sale_id       uuid                            references public.sales(id) on delete set null,
  type          public.loyalty_transaction_type not null,
  stamps_delta  int                             not null,
  balance_after int                             not null,
  reason        text,
  created_by    uuid                            not null references auth.users(id),
  created_at    timestamptz                     not null default now()
);

-- RN-LF04: una venta no puede generar sellos más de una vez.
create unique index if not exists ux_loyalty_tx_sale_earn
  on public.loyalty_transactions (sale_id) where type = 'earn';
create index if not exists ix_loyalty_tx_cliente
  on public.loyalty_transactions (tienda_id, cliente_id, created_at desc);

create table if not exists public.loyalty_rewards (
  id                    uuid                        primary key default gen_random_uuid(),
  tienda_id             uuid                        not null references public.tiendas(id) on delete cascade,
  cliente_id            uuid                        not null references public.clientes(id) on delete cascade,
  cost_stamps           int                         not null,
  reward_value_cop      numeric(14,2)               not null,
  status                public.loyalty_reward_status not null default 'available',
  source_transaction_id uuid                        not null references public.loyalty_transactions(id),
  generated_at          timestamptz                 not null default now(),
  expires_at            timestamptz                 not null,
  redeemed_at           timestamptz,
  redeemed_sale_id      uuid                        references public.sales(id),
  redeemed_by           uuid                        references auth.users(id),
  voided_at             timestamptz,
  voided_by             uuid                        references auth.users(id),
  voided_reason         text
);

create index if not exists ix_loyalty_rewards_cliente
  on public.loyalty_rewards (tienda_id, cliente_id, status);

-- ==================== 4. SALE_ITEMS: trazabilidad del canje ====================

alter table public.sale_items
  add column if not exists loyalty_reward_id uuid references public.loyalty_rewards(id),
  add column if not exists loyalty_discount_amount numeric(14,2) not null default 0
    check (loyalty_discount_amount >= 0);

comment on column public.sale_items.loyalty_reward_id is
  'Recompensa MOVE ON Club canjeada en esta línea (RN-LF12). Una recompensa por línea.';
comment on column public.sale_items.loyalty_discount_amount is
  'Descuento por canje de recompensa aplicado UNA vez a la línea (no por unidad). Excluido del tope RN-S09.';

alter table public.sales
  add column if not exists loyalty_discount_total numeric(14,2) not null default 0
    check (loyalty_discount_total >= 0);

comment on column public.sales.loyalty_discount_total is
  'Suma de descuentos por canje MOVE ON Club. discount_total = item + global + loyalty.';

-- ==================== 5. RLS: SOLO LECTURA ====================
-- Sin políticas de INSERT/UPDATE/DELETE: ni siquiera admin muta directo (RN-LF15).

alter table public.loyalty_accounts     enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.loyalty_rewards      enable row level security;

drop policy if exists "read_own_tienda_loyalty_accounts" on public.loyalty_accounts;
create policy "read_own_tienda_loyalty_accounts" on public.loyalty_accounts
  for select using (
    tienda_id in (
      select tienda_id from public.user_tiendas
      where user_id = auth.uid() and is_active = true
    )
  );

drop policy if exists "read_own_tienda_loyalty_transactions" on public.loyalty_transactions;
create policy "read_own_tienda_loyalty_transactions" on public.loyalty_transactions
  for select using (
    tienda_id in (
      select tienda_id from public.user_tiendas
      where user_id = auth.uid() and is_active = true
    )
  );

drop policy if exists "read_own_tienda_loyalty_rewards" on public.loyalty_rewards;
create policy "read_own_tienda_loyalty_rewards" on public.loyalty_rewards
  for select using (
    tienda_id in (
      select tienda_id from public.user_tiendas
      where user_id = auth.uid() and is_active = true
    )
  );

-- ==================== 6. CONFIG DEL PROGRAMA ====================
-- Lee settings.data.fidelizacion con defaults (8 sellos, $11.000, 30 días).
-- Permite ajustar el programa sin migración (ADR 0013 §6).

create or replace function public.loyalty_program_config(p_tienda_id uuid)
returns table (activo boolean, sellos_para_recompensa int, valor_recompensa_cop numeric, vigencia_dias int)
language sql
stable
set search_path = public
as $$
  select
    coalesce((s.data->'fidelizacion'->>'activo')::boolean, true),
    greatest(1, coalesce((s.data->'fidelizacion'->>'sellosParaRecompensa')::int, 8)),
    greatest(0, coalesce((s.data->'fidelizacion'->>'valorRecompensaCop')::numeric, 11000)),
    greatest(1, coalesce((s.data->'fidelizacion'->>'vigenciaDias')::int, 30))
  from (select 1) as one
  left join public.settings s on s.tienda_id = p_tienda_id;
$$;

revoke execute on function public.loyalty_program_config(uuid) from public, anon;
grant execute on function public.loyalty_program_config(uuid) to authenticated;

-- ==================== 7. NÚCLEO INTERNO DEL LEDGER ====================
-- Internas (execute revocado): solo los RPC SECURITY DEFINER las invocan
-- (el owner de las funciones bypassa el chequeo de EXECUTE).

-- Aplica un delta de sellos: inserta la transacción y actualiza la proyección
-- en la MISMA transacción. Devuelve el id de la transacción insertada.
-- p_truncate: si el balance quedaría negativo, se trunca en 0 y se anota el
-- faltante en reason (RN-LF14) en vez de fallar.
create or replace function public.loyalty_apply_delta(
  p_tienda_id uuid,
  p_cliente_id uuid,
  p_type public.loyalty_transaction_type,
  p_delta int,
  p_sale_id uuid,
  p_reason text,
  p_created_by uuid,
  p_truncate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_delta int := p_delta;
  v_reason text := p_reason;
  v_tx_id uuid;
begin
  insert into loyalty_accounts (tienda_id, cliente_id)
  values (p_tienda_id, p_cliente_id)
  on conflict (tienda_id, cliente_id) do nothing;

  select stamps_balance into v_balance
  from loyalty_accounts
  where tienda_id = p_tienda_id and cliente_id = p_cliente_id
  for update;

  if v_balance + v_delta < 0 then
    if not p_truncate then
      raise exception 'El ajuste dejaría el saldo de sellos en negativo';
    end if;
    v_reason := coalesce(v_reason, '') ||
      format(' [Truncado: faltaron %s sellos, ya consumidos en recompensas]', abs(v_balance + v_delta));
    v_delta := -v_balance;
  end if;

  v_balance := v_balance + v_delta;

  insert into loyalty_transactions (tienda_id, cliente_id, sale_id, type, stamps_delta, balance_after, reason, created_by)
  values (p_tienda_id, p_cliente_id, p_sale_id, p_type, v_delta, v_balance, nullif(btrim(coalesce(v_reason, '')), ''), p_created_by)
  returning id into v_tx_id;

  update loyalty_accounts
  set stamps_balance = v_balance,
      total_stamps_earned = total_stamps_earned + greatest(v_delta, 0)
  where tienda_id = p_tienda_id and cliente_id = p_cliente_id;

  return v_tx_id;
end;
$$;

revoke execute on function public.loyalty_apply_delta(uuid, uuid, public.loyalty_transaction_type, int, uuid, text, uuid, boolean) from public, anon, authenticated;

-- Genera las recompensas pendientes: mientras el saldo alcance el umbral,
-- consume los sellos (tx 'redeem') y crea la recompensa (RN-LF07). Una venta
-- puede generar más de una recompensa.
create or replace function public.loyalty_generate_rewards(
  p_tienda_id uuid,
  p_cliente_id uuid,
  p_sale_id uuid,
  p_created_by uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_balance int;
  v_tx_id uuid;
  v_generated int := 0;
begin
  select * into v_cfg from loyalty_program_config(p_tienda_id);

  select stamps_balance into v_balance
  from loyalty_accounts
  where tienda_id = p_tienda_id and cliente_id = p_cliente_id
  for update;

  if v_balance is null then
    return 0;
  end if;

  while v_balance >= v_cfg.sellos_para_recompensa loop
    v_tx_id := loyalty_apply_delta(
      p_tienda_id, p_cliente_id, 'redeem', -v_cfg.sellos_para_recompensa,
      p_sale_id, 'Sellos canjeados por recompensa MOVE ON Club', p_created_by
    );
    v_balance := v_balance - v_cfg.sellos_para_recompensa;

    insert into loyalty_rewards (
      tienda_id, cliente_id, cost_stamps, reward_value_cop,
      source_transaction_id, expires_at
    ) values (
      p_tienda_id, p_cliente_id, v_cfg.sellos_para_recompensa, v_cfg.valor_recompensa_cop,
      v_tx_id, now() + make_interval(days => v_cfg.vigencia_dias)
    );

    v_generated := v_generated + 1;
  end loop;

  return v_generated;
end;
$$;

revoke execute on function public.loyalty_generate_rewards(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- ==================== 8. AJUSTE MANUAL (admin, RN-LF16) ====================

create or replace function public.adjust_loyalty_stamps(
  p_tienda_id uuid,
  p_cliente_id uuid,
  p_delta int,
  p_reason text,
  p_created_by uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if auth.uid() is null or auth.uid() <> p_created_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede ajustar sellos';
  end if;

  if p_delta = 0 then
    raise exception 'El ajuste debe ser distinto de cero';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  if not exists (
    select 1 from clientes where id = p_cliente_id and tienda_id = p_tienda_id
  ) then
    raise exception 'Cliente no encontrado';
  end if;

  perform loyalty_apply_delta(
    p_tienda_id, p_cliente_id, 'adjustment', p_delta, null, btrim(p_reason), p_created_by
  );

  if p_delta > 0 then
    perform loyalty_generate_rewards(p_tienda_id, p_cliente_id, null, p_created_by);
  end if;

  select stamps_balance into v_balance
  from loyalty_accounts
  where tienda_id = p_tienda_id and cliente_id = p_cliente_id;

  insert into audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_created_by, 'loyalty.stamps_adjusted', 'loyalty_account', p_cliente_id,
    jsonb_build_object('delta', p_delta, 'reason', btrim(p_reason), 'balance_after', v_balance)
  );

  return v_balance;
end;
$$;

grant execute on function public.adjust_loyalty_stamps(uuid, uuid, int, text, uuid) to authenticated;

-- ==================== 9. CREATE_SALE_ATOMIC EXTENDIDO ====================
-- Cambios sobre 20260623_002:
--   * Nuevo parámetro p_loyalty_redemptions jsonb (default null):
--     [{ "reward_id": uuid, "item_index": int }] — índice 0-based sobre p_items.
--   * SECURITY DEFINER: necesario para escribir el ledger de fidelización
--     (RLS solo-SELECT). Los chequeos de auth/rol/caja ya eran explícitos.
--   * Canje = descuento dirigido UNA vez por línea (loyalty_discount_amount),
--     excluido del tope de descuento del cajero (ADR 0013 §5).
--   * Sellos: 1 por unidad elegible (participa_fidelizacion, sin descuento de
--     línea ni global prorrateado; la unidad canjeada no genera sello).

drop function if exists public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb, numeric, text
);

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

  -- RN-S09: el tope del cajero aplica SOLO al descuento discrecional; el canje
  -- de recompensa no es un descuento manual y queda excluido (RN-LF12).
  if v_role = 'cajero'
     and (v_discount_total - v_loyalty_total) > round(v_subtotal * 0.50, 2) then
    raise exception 'Descuentos mayores al 50%% requieren aprobación de admin';
  end if;

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

-- ==================== 10. VOID_SALE_ATOMIC EXTENDIDO ====================
-- Cambios sobre 20260529_002 (cuerpo idéntico + bloque de fidelización):
--   * Restaura recompensas canjeadas EN la venta anulada (el cliente no pierde
--     su premio porque la venta se anuló); si ya venció, queda 'expired'.
--   * Anula recompensas generadas POR la venta que sigan disponibles,
--     devolviendo los sellos consumidos al generarlas.
--   * Reversa los sellos ganados; si el saldo no alcanza (ya se consumieron en
--     una recompensa redimida), trunca en 0 y anota el faltante (RN-LF14).

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
    and p.tipo <> 'prepared';

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

-- ==================== 11. CREATE_PRODUCT_WITH_INITIAL_STOCK EXTENDIDO ====================
-- Cuerpo idéntico a 20260713_001 + p_participa_fidelizacion (default false).
-- Se elimina la versión de 18 argumentos para no dejar un overload huérfano.

drop function if exists public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location, text, text
);

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

  if p_tipo = 'prepared' and coalesce(p_initial_stock, 0) > 0 then
    raise exception 'Los productos preparados no controlan inventario inicial';
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
