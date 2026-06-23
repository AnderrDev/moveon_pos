-- ============================================================
-- REPORTE DE ESTADO DEL NEGOCIO — MOVEONAPP POS
-- Solo lectura. Pegar en el SQL Editor de Supabase.
-- ============================================================
-- Antes de correr cada sección:
--   1. Reemplaza '00000000-0000-0000-0000-000000000000' por el UUID real
--      de tu tienda (tabla `tiendas`, columna `id`).
--   2. Ajusta el rango de fechas en `desde` / `hasta` (zona horaria local,
--      no UTC — el script convierte usando tiendas.timezone).
--
-- Para ver el UUID y zona horaria de tu(s) tienda(s):
--   select id, nombre, timezone from tiendas;
-- ============================================================


-- ============================================================
-- 0. PARÁMETROS (edita aquí y copia/pega en cada sección si tu
--    cliente SQL no permite reusar un WITH entre bloques)
-- ============================================================
-- tienda_id : '00000000-0000-0000-0000-000000000000'
-- desde     : '2026-06-01'
-- hasta     : '2026-06-22'


-- ============================================================
-- 1. RESUMEN GENERAL DEL PERIODO
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  count(*)                                    as ventas_completadas,
  sum(s.total)                                as total_facturado,
  sum(s.subtotal)                             as subtotal,
  sum(s.discount_total)                       as total_descuentos,
  sum(s.tax_total)                            as total_impuestos,
  round(avg(s.total), 2)                      as ticket_promedio,
  min(s.created_at)                           as primera_venta_utc,
  max(s.created_at)                           as ultima_venta_utc
from sales s
join params p on p.tienda_id = s.tienda_id
where s.status = 'completed'
  and s.created_at >= p.desde::timestamptz
  and s.created_at <  (p.hasta + 1)::timestamptz;


-- ============================================================
-- 2. VENTAS POR DÍA (calendario local de la tienda)
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  (s.created_at at time zone t.timezone)::date as dia_local,
  count(*)                                      as num_ventas,
  sum(s.total)                                  as total_facturado,
  round(avg(s.total), 2)                        as ticket_promedio
from sales s
join params p on p.tienda_id = s.tienda_id
join tiendas t on t.id = s.tienda_id
where s.status = 'completed'
  and s.created_at >= p.desde::timestamptz
  and s.created_at <  (p.hasta + 1)::timestamptz
group by 1
order by 1;


-- ============================================================
-- 3. VENTAS POR HORA DEL DÍA (¿a qué hora se vende más?)
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  extract(hour from (s.created_at at time zone t.timezone))::int as hora_local,
  count(*)                                                       as num_ventas,
  sum(s.total)                                                   as total_facturado,
  round(avg(s.total), 2)                                         as ticket_promedio
from sales s
join params p on p.tienda_id = s.tienda_id
join tiendas t on t.id = s.tienda_id
where s.status = 'completed'
  and s.created_at >= p.desde::timestamptz
  and s.created_at <  (p.hasta + 1)::timestamptz
group by 1
order by 1;


-- ============================================================
-- 4. PRODUCTOS MÁS VENDIDOS (cantidad y facturación)
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  si.producto_nombre,
  si.producto_sku,
  count(distinct si.sale_id)        as num_ventas_donde_aparece,
  sum(si.quantity)                  as unidades_vendidas,
  sum(si.total)                     as total_facturado,
  round(avg(si.unit_price), 2)      as precio_promedio
from sale_items si
join sales s   on s.id = si.sale_id
join params p  on p.tienda_id = s.tienda_id
where s.status = 'completed'
  and s.created_at >= p.desde::timestamptz
  and s.created_at <  (p.hasta + 1)::timestamptz
group by si.producto_nombre, si.producto_sku
order by total_facturado desc
limit 50;


-- ============================================================
-- 5. VENTAS POR MÉTODO DE PAGO
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  pay.metodo,
  count(*)            as num_pagos,
  sum(pay.amount)      as total
from payments pay
join sales s  on s.id = pay.sale_id
join params p on p.tienda_id = s.tienda_id
where s.status = 'completed'
  and s.created_at >= p.desde::timestamptz
  and s.created_at <  (p.hasta + 1)::timestamptz
group by pay.metodo
order by total desc;


-- ============================================================
-- 6. SESIONES DE CAJA — APERTURA Y CIERRE (horas locales)
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  cs.id                                              as cash_session_id,
  (cs.opened_at at time zone t.timezone)              as apertura_local,
  (cs.closed_at at time zone t.timezone)               as cierre_local,
  case when cs.closed_at is not null
       then round(extract(epoch from (cs.closed_at - cs.opened_at)) / 3600.0, 2)
  end                                                  as horas_abierta,
  cs.status,
  cs.opening_amount,
  cs.expected_cash_amount,
  cs.actual_cash_amount,
  cs.difference                                       as diferencia_efectivo,
  cs.expected_sales_amount,
  cs.actual_sales_amount,
  cs.sales_difference                                 as diferencia_ventas,
  cs.notas_cierre
from cash_sessions cs
join params p on p.tienda_id = cs.tienda_id
join tiendas t on t.id = cs.tienda_id
where cs.opened_at >= p.desde::timestamptz
  and cs.opened_at <  (p.hasta + 1)::timestamptz
order by cs.opened_at;


-- ============================================================
-- 7. MOVIMIENTOS DE CAJA (entradas/salidas/gastos/correcciones)
--    Excluye anulados; para verlos, quita el filtro status = 'active'.
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  (cm.created_at at time zone t.timezone) as fecha_local,
  cm.tipo,
  cm.amount,
  cm.motivo,
  cm.status,
  cm.cash_session_id
from cash_movements cm
join cash_sessions cs on cs.id = cm.cash_session_id
join params p on p.tienda_id = cs.tienda_id
join tiendas t on t.id = cs.tienda_id
where cm.created_at >= p.desde::timestamptz
  and cm.created_at <  (p.hasta + 1)::timestamptz
order by cm.created_at;


-- ============================================================
-- 8. VENTAS ANULADAS (voided) — para auditoría, no suman al total
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
)
select
  s.sale_number,
  (s.created_at at time zone t.timezone) as creada_local,
  (s.voided_at  at time zone t.timezone) as anulada_local,
  s.total,
  s.voided_reason
from sales s
join params p on p.tienda_id = s.tienda_id
join tiendas t on t.id = s.tienda_id
where s.status = 'voided'
  and s.created_at >= p.desde::timestamptz
  and s.created_at <  (p.hasta + 1)::timestamptz
order by s.created_at;


-- ============================================================
-- 9. RESUMEN VENTAS vs CAJA POR SESIÓN
--    Cuánto se vendió en cada turno y si cuadró la caja.
-- ============================================================
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tienda_id,
         '2026-06-01'::date as desde,
         '2026-06-22'::date as hasta
),
ventas_por_sesion as (
  select s.cash_session_id,
         count(*)       as num_ventas,
         sum(s.total)   as total_vendido
  from sales s
  join params p on p.tienda_id = s.tienda_id
  where s.status = 'completed'
  group by s.cash_session_id
)
select
  cs.id                                 as cash_session_id,
  (cs.opened_at at time zone t.timezone) as apertura_local,
  (cs.closed_at at time zone t.timezone) as cierre_local,
  cs.status,
  coalesce(v.num_ventas, 0)             as num_ventas,
  coalesce(v.total_vendido, 0)          as total_vendido,
  cs.expected_sales_amount,
  cs.actual_sales_amount,
  cs.sales_difference                   as diferencia_ventas,
  cs.difference                         as diferencia_efectivo
from cash_sessions cs
join params p on p.tienda_id = cs.tienda_id
join tiendas t on t.id = cs.tienda_id
left join ventas_por_sesion v on v.cash_session_id = cs.id
where cs.opened_at >= p.desde::timestamptz
  and cs.opened_at <  (p.hasta + 1)::timestamptz
order by cs.opened_at;
