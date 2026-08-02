-- 20260721_003: RPCs de agregación mensual para la comparativa de Finanzas
-- Mismo bug latente que el de inventario (20260721_001): la comparativa de 6 meses
-- descargaba todas las ventas/gastos del período y sumaba en el cliente, con el
-- tope silencioso de 1000 filas de PostgREST. La agregación pasa al servidor.

-- Total de ventas completadas por mes local (tz de la tienda; Colombia por defecto).
create or replace function public.get_monthly_sales_totals(
  p_tienda_id uuid,
  p_from timestamptz,
  p_tz text default 'America/Bogota'
)
returns table (month text, total numeric)
language sql
stable
set search_path to 'public'
as $$
  select
    to_char(created_at at time zone p_tz, 'YYYY-MM') as month,
    coalesce(sum(total), 0) as total
  from sales
  where tienda_id = p_tienda_id
    and status = 'completed'
    and created_at >= p_from
  group by 1
  order by 1;
$$;

-- Total de gastos activos por mes contable (fecha_gasto es date, sin tz).
create or replace function public.get_monthly_expense_totals(
  p_tienda_id uuid,
  p_from date
)
returns table (month text, total numeric)
language sql
stable
set search_path to 'public'
as $$
  select
    to_char(fecha_gasto, 'YYYY-MM') as month,
    coalesce(sum(monto), 0) as total
  from expenses
  where tienda_id = p_tienda_id
    and status = 'active'
    and fecha_gasto >= p_from
  group by 1
  order by 1;
$$;

-- Grants consistentes con el hardening (20260508_001): solo authenticated.
revoke execute on function public.get_monthly_sales_totals(uuid, timestamptz, text) from public, anon;
grant execute on function public.get_monthly_sales_totals(uuid, timestamptz, text) to authenticated;
revoke execute on function public.get_monthly_expense_totals(uuid, date) from public, anon;
grant execute on function public.get_monthly_expense_totals(uuid, date) to authenticated;

-- get_stock_levels (20260721_001) se creó sin grants explícitos — se alinea aquí.
revoke execute on function public.get_stock_levels(uuid) from public, anon;
grant execute on function public.get_stock_levels(uuid) to authenticated;
