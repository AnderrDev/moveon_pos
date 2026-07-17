-- ============================================================
-- MIGRACIÓN — Fondo de reinversión de mercancía (módulo Finanzas)
-- El costo de lo vendido no es gasto ni utilidad: es dinero que
-- debe volver a convertirse en mercancía. El fondo lo controla:
--   disponible = saldo_inicial
--              + Σ costo de productos vendidos (ventas completadas)
--              − Σ compras de mercancía (entradas de inventario con costo)
-- desde una fecha de inicio configurable por tienda (el histórico
-- de costos es incompleto y no debe contaminar el saldo).
-- ============================================================

-- ==================== SETTINGS ====================

create table reinvestment_fund_settings (
  tienda_id      uuid          primary key references tiendas(id) on delete cascade,
  saldo_inicial  numeric(14,2) not null default 0 check (saldo_inicial >= 0),
  fecha_inicio   date          not null,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

create trigger reinvestment_fund_settings_updated_at before update on reinvestment_fund_settings
  for each row execute function update_updated_at();

-- ==================== RLS (solo admin) ====================

alter table reinvestment_fund_settings enable row level security;

create policy "admin_only" on public.reinvestment_fund_settings
  for all to authenticated
  using (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = reinvestment_fund_settings.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = reinvestment_fund_settings.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

-- ==================== RPC ====================

-- Totales del fondo en un solo viaje. Security invoker: las policies RLS
-- de sales/sale_items/inventory_movements aplican al usuario autenticado.
-- El COGS usa el costo ACTUAL del producto (misma convención que /reportes);
-- productos sin costo capturado se excluyen (no se asume 0).
-- `p_mes_hasta` es exclusivo (primer instante del mes siguiente).
-- Reconciliado 2026-07-16 con el remoto: la versión desplegada NO devuelve
-- `ventas_sin_costo` (expenses.repository.ts lo trata con fallback a 0).
create or replace function public.get_reinvestment_fund_totals(
  p_tienda_id uuid,
  p_desde     timestamptz,
  p_mes_desde timestamptz,
  p_mes_hasta timestamptz
) returns table (
  cogs_acumulado     numeric,
  compras_acumuladas numeric,
  cogs_mes           numeric,
  compras_mes        numeric,
  entradas_sin_costo integer
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  with cogs as (
    select s.created_at, si.quantity * p.costo as costo
    from sale_items si
    join sales s on s.id = si.sale_id
    join productos p on p.id = si.producto_id
    where s.tienda_id = p_tienda_id
      and s.status = 'completed'
      and s.created_at >= p_desde
      and p.costo is not null
  ),
  compras as (
    select m.created_at, m.cantidad * m.costo_unitario as costo
    from inventory_movements m
    where m.tienda_id = p_tienda_id
      and m.tipo = 'entry'
      and m.created_at >= p_desde
  )
  select
    coalesce((select sum(costo) from cogs), 0),
    coalesce((select sum(costo) from compras where costo is not null), 0),
    coalesce((select sum(costo) from cogs
              where created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    coalesce((select sum(costo) from compras
              where costo is not null and created_at >= p_mes_desde and created_at < p_mes_hasta), 0),
    (select count(*)::int from compras where costo is null);
$$;

revoke execute on function public.get_reinvestment_fund_totals(
  uuid, timestamptz, timestamptz, timestamptz
) from public, anon;

grant execute on function public.get_reinvestment_fund_totals(
  uuid, timestamptz, timestamptz, timestamptz
) to authenticated;
