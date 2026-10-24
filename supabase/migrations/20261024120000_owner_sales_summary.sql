-- =====================================================
-- owner_sales_summary: resumen de ventas para la app iOS del dueño (PLAN-78)
-- =====================================================
-- ADR 0021 §4: la app iOS no reimplementa reducciones de negocio; las cifras
-- salen de esta RPC. Replica `buildSalesSummary` del POS web
-- (reports/domain/services/sales-summary.ts, usado por `getDailyReport`):
--   * totales, descuentos y ticket promedio solo de ventas completadas;
--   * desglose por método de pago (completadas);
--   * por producto con utilidad sobre `sale_items.unit_cost` (ADR 0019): si a
--     una línea le falta el costo, el producto queda sin costo ni utilidad y no
--     suma a `utilidad_total` — nunca se asume costo 0;
--   * por cajero (completadas + anuladas), por hora y por día locales.
-- La paridad con el TS la prueba tests/integration/owner-sales-summary.parity.test.ts.
--
-- Rango: [p_from 00:00, p_to + 1 00:00) en `tiendas.timezone`, igual que
-- `getStoreRangeUtc`. Solo lectura: STABLE + SECURITY INVOKER, así RLS sigue
-- filtrando por tienda. Solo `admin` (en el web /reportes es admin-only).

create or replace function public.owner_sales_summary(
  p_tienda_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_tiendas ut
    where ut.user_id = auth.uid()
      and ut.tienda_id = p_tienda_id
      and ut.rol = 'admin'
      and ut.is_active
  ) then
    raise exception 'Solo el dueño puede ver el resumen de ventas' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;

  -- Un año calendario completo como máximo (incluye años bisiestos).
  if p_to - p_from > 366 then
    raise exception 'El período no puede superar un año' using errcode = '22023';
  end if;

  select t.timezone into v_tz from public.tiendas t where t.id = p_tienda_id;
  v_tz := coalesce(v_tz, 'America/Bogota');
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;

  with period_sales as (
    select s.*
    from public.sales s
    where s.tienda_id = p_tienda_id
      and s.created_at >= v_start
      and s.created_at < v_end
  ),
  completed as (
    select * from period_sales where status = 'completed'
  ),
  totals as (
    select
      coalesce(sum(c.total), 0) as total_ventas,
      count(*) as count_ventas,
      coalesce(sum(c.subtotal), 0) as subtotal_ventas,
      coalesce(sum(c.tax_total), 0) as tax_total,
      coalesce(sum(c.discount_total), 0) as discount_total,
      coalesce(sum(c.item_discount_total), 0) as item_discount_total,
      coalesce(sum(c.global_discount_total), 0) as global_discount_total,
      count(*) filter (where c.discount_total > 0) as discounted_sales_count,
      coalesce(
        avg(case when c.subtotal > 0 then c.discount_total / c.subtotal else 0 end)
          filter (where c.discount_total > 0) * 100,
        0
      ) as average_discount_percentage
    from completed c
  ),
  payment_rows as (
    select p.metodo::text as metodo, count(*) as count, sum(p.amount) as total
    from public.payments p
    join completed c on c.id = p.sale_id
    group by p.metodo
  ),
  item_rows as (
    select si.*, c.created_at as sale_created_at
    from public.sale_items si
    join completed c on c.id = si.sale_id
  ),
  product_groups as (
    select
      i.producto_id,
      -- Nombre y SKU de la venta más reciente, como el web (que recorre las
      -- ventas de la más nueva a la más vieja y se queda con la primera).
      (array_agg(i.producto_nombre order by i.sale_created_at desc, i.sale_id desc))[1] as nombre,
      (array_agg(i.producto_sku order by i.sale_created_at desc, i.sale_id desc))[1] as sku,
      count(distinct i.sale_id) as num_ventas,
      sum(i.quantity) as qty,
      sum(i.total) as total,
      case
        when bool_or(i.unit_cost is null) then null
        else round(sum(i.unit_cost * i.quantity))
      end as costo_total
    from item_rows i
    group by i.producto_id
  ),
  product_rows as (
    select
      g.*,
      case when g.qty > 0 then round(g.total / g.qty, 2) else 0 end as avg_price,
      case when g.costo_total is not null and g.qty > 0 then round(g.costo_total / g.qty) end as costo_unitario,
      g.total - g.costo_total as utilidad,
      case
        when g.costo_total is not null and g.total > 0 then (g.total - g.costo_total) / g.total * 100
      end as margen_pct
    from product_groups g
  ),
  cashier_rows as (
    select
      s.cashier_id,
      (array_agg(s.cashier_email order by s.created_at desc) filter (where s.cashier_email is not null))[1]
        as cashier_email,
      count(*) filter (where s.status = 'completed') as count_completed,
      count(*) filter (where s.status = 'voided') as count_voided,
      coalesce(sum(s.total) filter (where s.status = 'completed'), 0) as total_ventas,
      coalesce(sum(s.tax_total) filter (where s.status = 'completed'), 0) as tax_total
    from period_sales s
    group by s.cashier_id
  ),
  hourly_rows as (
    select
      extract(hour from c.created_at at time zone v_tz)::int as hour,
      count(*) as count,
      sum(c.total) as total
    from completed c
    group by 1
  ),
  daily_rows as (
    select
      to_char((c.created_at at time zone v_tz)::date, 'YYYY-MM-DD') as date,
      count(*) as count,
      sum(c.total) as total
    from completed c
    group by 1
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'timezone', v_tz,
    'total_ventas', t.total_ventas,
    'count_ventas', t.count_ventas,
    'count_anuladas', (select count(*) from period_sales where status = 'voided'),
    'subtotal_ventas', t.subtotal_ventas,
    'tax_total', t.tax_total,
    'discount_total', t.discount_total,
    'item_discount_total', t.item_discount_total,
    'global_discount_total', t.global_discount_total,
    'discounted_sales_count', t.discounted_sales_count,
    'average_discount_percentage', t.average_discount_percentage,
    'avg_venta', case when t.count_ventas > 0 then round(t.total_ventas / t.count_ventas) else 0 end,
    'utilidad_total', (select coalesce(sum(utilidad), 0) from product_rows),
    'payment_breakdown', coalesce((
      select jsonb_agg(
        jsonb_build_object('metodo', r.metodo, 'count', r.count, 'total', r.total)
        order by r.total desc, r.metodo
      )
      from payment_rows r
    ), '[]'::jsonb),
    'product_sales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', r.producto_id,
          'nombre', r.nombre,
          'sku', r.sku,
          'num_ventas', r.num_ventas,
          'qty', r.qty,
          'total', r.total,
          'avg_price', r.avg_price,
          'costo_unitario', r.costo_unitario,
          'costo_total', r.costo_total,
          'utilidad', r.utilidad,
          'margen_pct', r.margen_pct
        )
        order by r.total desc, r.producto_id
      )
      from product_rows r
    ), '[]'::jsonb),
    'cashier_breakdown', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'cashier_id', r.cashier_id,
          'cashier_email', r.cashier_email,
          'count_completed', r.count_completed,
          'count_voided', r.count_voided,
          'total_ventas', r.total_ventas,
          'tax_total', r.tax_total
        )
        order by r.total_ventas desc, r.cashier_id
      )
      from cashier_rows r
    ), '[]'::jsonb),
    'hourly_sales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'hour', r.hour,
          'count', r.count,
          'total', r.total,
          'avg_ticket', round(r.total / r.count)
        )
        order by r.hour
      )
      from hourly_rows r
    ), '[]'::jsonb),
    'daily_sales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', r.date,
          'count', r.count,
          'total', r.total,
          'avg_ticket', round(r.total / r.count)
        )
        order by r.date
      )
      from daily_rows r
    ), '[]'::jsonb)
  )
  into v_result
  from totals t;

  return v_result;
end;
$$;

comment on function public.owner_sales_summary(uuid, date, date) is
  'Resumen de ventas del período para la app iOS del dueño (ADR 0021, PLAN-78). '
  'Solo lectura, solo admin. Paridad con buildSalesSummary del POS web.';

revoke all on function public.owner_sales_summary(uuid, date, date) from public, anon;
grant execute on function public.owner_sales_summary(uuid, date, date) to authenticated;
