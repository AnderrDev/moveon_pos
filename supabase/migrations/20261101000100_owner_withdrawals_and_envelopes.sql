-- =====================================================
-- ADR 0025 (2026-11-01): asistente de finanzas — reparto del dinero en sobres
-- =====================================================
-- 1. Retiros del dueño (`owner_withdrawals`): lo que el dueño toma de la
--    utilidad. No es un gasto (no resta de la ganancia); resta del sobre de
--    utilidad. Solo admin, sin escritura directa: RPC
--    `register_owner_withdrawal_atomic` (origen caja → `cash_out` en la misma
--    transacción, idempotente) y `void_owner_withdrawal_atomic` (anula también
--    la salida de caja). `void_cash_movement_atomic` anula el retiro enlazado.
-- 2. `reinvestment_fund_settings` gana saldos iniciales de utilidad y fijos y
--    la meta de días de inventario (el fondo ES el sobre de mercancía).
-- 3. RPC de lectura `get_money_envelope_totals`: todos los acumulados desde
--    la fecha de inicio + el mes visible + el costo vendido de 28 días, en un
--    solo viaje (security invoker: aplica RLS admin de expenses/retiros).
-- =====================================================

-- ==================== 2. Settings ====================

alter table public.reinvestment_fund_settings
  add column if not exists saldo_inicial_utilidad numeric(14,2) not null default 0
    check (saldo_inicial_utilidad >= 0),
  add column if not exists saldo_inicial_fijos numeric(14,2) not null default 0
    check (saldo_inicial_fijos >= 0),
  add column if not exists dias_inventario_meta integer not null default 45
    check (dias_inventario_meta between 7 and 365);

comment on column public.reinvestment_fund_settings.saldo_inicial_utilidad is
  'Utilidad ya apartada al arrancar los sobres (ADR 0025).';
comment on column public.reinvestment_fund_settings.saldo_inicial_fijos is
  'Dinero ya guardado para arriendo/nómina al arrancar los sobres (ADR 0025).';
comment on column public.reinvestment_fund_settings.dias_inventario_meta is
  'Meta de días de venta cubiertos por el inventario al costo (semáforo, ADR 0025).';

-- ==================== 1. Retiros del dueño ====================

create table if not exists public.owner_withdrawals (
  id               uuid          primary key default gen_random_uuid(),
  tienda_id        uuid          not null references public.tiendas(id) on delete cascade,
  monto            numeric(14,2) not null check (monto > 0),
  fecha            date          not null,
  origen           text          not null check (origen in ('caja', 'banco')),
  nota             text,
  cash_movement_id uuid          references public.cash_movements(id),
  status           text          not null default 'active' check (status in ('active', 'voided')),
  voided_by        uuid,
  voided_at        timestamptz,
  voided_reason    text,
  idempotency_key  text,
  created_by       uuid          not null,
  created_at       timestamptz   not null default now()
);

create index if not exists ix_owner_withdrawals_tienda_fecha
  on public.owner_withdrawals (tienda_id, fecha desc);
create unique index if not exists ux_owner_withdrawals_idempotency_key
  on public.owner_withdrawals (tienda_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists ux_owner_withdrawals_cash_movement
  on public.owner_withdrawals (cash_movement_id)
  where cash_movement_id is not null;

comment on table public.owner_withdrawals is
  'Retiros del dueño (ADR 0025): plata que sale del sobre de utilidad. No es gasto. Escritura solo vía RPC.';

alter table public.owner_withdrawals enable row level security;

drop policy if exists "admin_only" on public.owner_withdrawals;
create policy "admin_only" on public.owner_withdrawals
  for select to authenticated
  using (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = owner_withdrawals.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

grant select on public.owner_withdrawals to authenticated;
revoke insert, update, delete on public.owner_withdrawals from anon, authenticated;

-- -----------------------------------------------------
-- register_owner_withdrawal_atomic
-- -----------------------------------------------------
create or replace function public.register_owner_withdrawal_atomic(
  p_tienda_id uuid,
  p_monto numeric,
  p_fecha date,
  p_origen text,
  p_nota text default null,
  p_idempotency_key text default null
)
returns public.owner_withdrawals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_key        text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_nota       text := nullif(btrim(coalesce(p_nota, '')), '');
  v_session_id uuid;
  v_movement   public.cash_movements;
  v_row        public.owner_withdrawals;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and rol = 'admin' and is_active = true
  ) then
    raise exception 'Solo el dueño puede registrar retiros';
  end if;

  if v_key is not null then
    select * into v_row from public.owner_withdrawals
    where tienda_id = p_tienda_id and idempotency_key = v_key;
    if found then
      return v_row;
    end if;
  end if;

  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto) then
    raise exception 'El monto debe ser un valor entero en pesos mayor a 0';
  end if;

  if p_fecha is null then
    raise exception 'La fecha es obligatoria';
  end if;

  if p_origen not in ('caja', 'banco') then
    raise exception 'El origen debe ser caja o banco';
  end if;

  if v_nota is not null and length(v_nota) > 200 then
    raise exception 'La nota no puede pasar de 200 caracteres';
  end if;

  if p_origen = 'caja' then
    select id into v_session_id
    from public.cash_sessions
    where tienda_id = p_tienda_id and status = 'open'
    order by opened_at desc
    limit 1;

    if v_session_id is null then
      raise exception 'NO_OPEN_CASH_SESSION';
    end if;

    insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
    values (
      v_session_id, 'cash_out', p_monto,
      'Retiro de utilidad' || coalesce(': ' || v_nota, ''),
      v_uid
    )
    returning * into v_movement;
  end if;

  insert into public.owner_withdrawals (
    tienda_id, monto, fecha, origen, nota, cash_movement_id, created_by, idempotency_key
  ) values (
    p_tienda_id, p_monto, p_fecha, p_origen, v_nota, v_movement.id, v_uid, v_key
  )
  returning * into v_row;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, entity_label, metadata)
  values (
    p_tienda_id, v_uid, 'owner_withdrawal.created', 'owner_withdrawal', v_row.id,
    coalesce(v_nota, 'Retiro de utilidad'),
    jsonb_build_object('monto', p_monto, 'origen', p_origen, 'cash_movement_id', v_movement.id)
  );

  return v_row;
exception
  when unique_violation then
    if v_key is not null then
      select * into v_row from public.owner_withdrawals
      where tienda_id = p_tienda_id and idempotency_key = v_key;
      if found then
        return v_row;
      end if;
    end if;
    raise;
end;
$$;

revoke all on function public.register_owner_withdrawal_atomic(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.register_owner_withdrawal_atomic(uuid, numeric, date, text, text, text) to authenticated;

-- -----------------------------------------------------
-- void_owner_withdrawal_atomic
-- -----------------------------------------------------
create or replace function public.void_owner_withdrawal_atomic(
  p_withdrawal_id uuid,
  p_tienda_id uuid,
  p_reason text
)
returns public.owner_withdrawals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_reason      text := btrim(coalesce(p_reason, ''));
  v_row         public.owner_withdrawals;
  v_movement_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and rol = 'admin' and is_active = true
  ) then
    raise exception 'Solo el dueño puede anular retiros';
  end if;

  if length(v_reason) < 10 or length(v_reason) > 300 then
    raise exception 'El motivo debe tener entre 10 y 300 caracteres';
  end if;

  update public.owner_withdrawals
  set status = 'voided', voided_by = v_uid, voided_at = now(), voided_reason = v_reason
  where id = p_withdrawal_id and tienda_id = p_tienda_id and status = 'active'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'El retiro no existe o ya estaba anulado';
  end if;

  if v_row.cash_movement_id is not null then
    update public.cash_movements
    set status = 'voided', voided_by = v_uid, voided_at = now(),
        voided_reason = 'Retiro anulado: ' || v_reason
    where id = v_row.cash_movement_id and status = 'active'
    returning id into v_movement_id;
  end if;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, entity_label, metadata)
  values (
    p_tienda_id, v_uid, 'owner_withdrawal.voided', 'owner_withdrawal', v_row.id,
    coalesce(v_row.nota, 'Retiro de utilidad'),
    jsonb_build_object('reason', v_reason, 'monto', v_row.monto, 'cash_movement_id', v_movement_id)
  );

  return v_row;
end;
$$;

revoke all on function public.void_owner_withdrawal_atomic(uuid, uuid, text) from public, anon;
grant execute on function public.void_owner_withdrawal_atomic(uuid, uuid, text) to authenticated;

-- -----------------------------------------------------
-- void_cash_movement_atomic: también anula el retiro enlazado (igual que el gasto).
-- Mismo cuerpo que 20261024160000 + el UPDATE sobre owner_withdrawals.
-- -----------------------------------------------------
create or replace function public.void_cash_movement_atomic(
  p_movement_id uuid,
  p_tienda_id uuid,
  p_voided_by uuid,
  p_voided_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id   uuid;
  v_expense_id    uuid;
  v_withdrawal_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_voided_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede anular movimientos de caja';
  end if;

  update public.cash_movements cm
  set status        = 'voided',
      voided_by     = p_voided_by,
      voided_at     = now(),
      voided_reason = p_voided_reason
  from public.cash_sessions cs
  where cm.id = p_movement_id
    and cm.cash_session_id = cs.id
    and cs.tienda_id = p_tienda_id
    and cm.status = 'active'
  returning cm.id into v_movement_id;

  if v_movement_id is null then
    raise exception 'Movimiento no encontrado o ya anulado';
  end if;

  update public.expenses
  set status        = 'voided',
      voided_by     = p_voided_by,
      voided_at     = now(),
      voided_reason = p_voided_reason
  where cash_movement_id = p_movement_id
    and tienda_id = p_tienda_id
    and status = 'active'
  returning id into v_expense_id;

  update public.owner_withdrawals
  set status        = 'voided',
      voided_by     = p_voided_by,
      voided_at     = now(),
      voided_reason = p_voided_reason
  where cash_movement_id = p_movement_id
    and tienda_id = p_tienda_id
    and status = 'active'
  returning id into v_withdrawal_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_voided_by, 'cash_movement.voided', 'cash_movement', p_movement_id,
    jsonb_build_object('reason', p_voided_reason, 'expense_id', v_expense_id, 'owner_withdrawal_id', v_withdrawal_id)
  );

  return v_movement_id;
end;
$$;

-- ==================== 3. Totales de los sobres ====================
-- Fijos pagados = gastos activos ligados a un empleado (nómina) o cuya
-- categoría + concepto coincide con una plantilla activa (misma regla que
-- `buildFixedCommitments`). Los demás gastos activos son "día a día".
-- `p_mes_hasta` y `p_hoy` son exclusivos (primer instante siguiente).
create or replace function public.get_money_envelope_totals(
  p_tienda_id uuid,
  p_desde     timestamptz,
  p_mes_desde timestamptz,
  p_mes_hasta timestamptz,
  p_hoy       timestamptz
) returns table (
  entradas_acumuladas    numeric,
  entradas_mes           numeric,
  cogs_acumulado         numeric,
  cogs_mes               numeric,
  compras_acumuladas     numeric,
  compras_mes            numeric,
  fijos_pagados_acum     numeric,
  fijos_pagados_mes      numeric,
  variables_acum         numeric,
  variables_mes          numeric,
  retiros_acum           numeric,
  retiros_mes            numeric,
  cogs_ultimos_28_dias   numeric,
  ventas_sin_costo       integer,
  entradas_sin_costo     integer
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  with tz as (
    select coalesce(t.timezone, 'America/Bogota') as tz from public.tiendas t where t.id = p_tienda_id
  ),
  ventas as (
    select s.created_at, s.total
    from public.sales s
    where s.tienda_id = p_tienda_id and s.status = 'completed' and s.created_at >= p_desde
  ),
  cogs as (
    select s.created_at, si.quantity * si.unit_cost as costo, si.unit_cost
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.tienda_id = p_tienda_id and s.status = 'completed' and s.created_at >= p_desde
  ),
  compras as (
    select m.created_at, m.cantidad * m.costo_unitario as costo
    from public.inventory_movements m
    where m.tienda_id = p_tienda_id and m.tipo = 'entry' and m.created_at >= p_desde
  ),
  gastos as (
    select
      (e.fecha_gasto::timestamp at time zone (select tz from tz)) as created_at,
      e.monto,
      (e.empleado_id is not null or exists (
        select 1 from public.expense_templates t
        where t.tienda_id = e.tienda_id and t.is_active
          and t.category_id = e.category_id and t.concepto = e.concepto
      )) as es_fijo
    from public.expenses e
    where e.tienda_id = p_tienda_id and e.status = 'active'
      and (e.fecha_gasto::timestamp at time zone (select tz from tz)) >= p_desde
  ),
  retiros as (
    select (w.fecha::timestamp at time zone (select tz from tz)) as created_at, w.monto
    from public.owner_withdrawals w
    where w.tienda_id = p_tienda_id and w.status = 'active'
      and (w.fecha::timestamp at time zone (select tz from tz)) >= p_desde
  )
  select
    coalesce((select sum(total) from ventas), 0),
    coalesce((select sum(total) from ventas where created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((select sum(costo) from cogs where unit_cost is not null), 0),
    coalesce((select sum(costo) from cogs where unit_cost is not null
              and created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((select sum(costo) from compras where costo is not null), 0),
    coalesce((select sum(costo) from compras where costo is not null
              and created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((select sum(monto) from gastos where es_fijo), 0),
    coalesce((select sum(monto) from gastos where es_fijo
              and created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((select sum(monto) from gastos where not es_fijo), 0),
    coalesce((select sum(monto) from gastos where not es_fijo
              and created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((select sum(monto) from retiros), 0),
    coalesce((select sum(monto) from retiros
              where created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((
      select sum(si.quantity * si.unit_cost)
      from public.sale_items si
      join public.sales s on s.id = si.sale_id
      where s.tienda_id = p_tienda_id and s.status = 'completed' and si.unit_cost is not null
        and s.created_at >= p_hoy - interval '28 days' and s.created_at < p_hoy
    ), 0),
    (select count(*)::int from cogs where unit_cost is null),
    (select count(*)::int from compras where costo is null);
$$;

revoke execute on function public.get_money_envelope_totals(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_money_envelope_totals(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
