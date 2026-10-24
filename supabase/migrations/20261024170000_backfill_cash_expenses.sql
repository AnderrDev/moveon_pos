-- =====================================================
-- Ola 1 (2026-10-24): recuperar en Finanzas los "Gasto" hechos desde Caja
-- =====================================================
-- Antes de 20261024160000 un movimiento de caja tipo 'expense' no creaba su
-- gasto. Esta migración crea el gasto de cada movimiento ACTIVO que no lo
-- tenga, en la categoría "Gastos de caja", con la fecha local del movimiento.
-- Idempotente: volver a correrla no duplica (filtra por cash_movement_id).
-- Es un cambio de DATOS: en producción requiere OK explícito del dueño.
-- =====================================================

insert into public.expenses (
  tienda_id, category_id, concepto, monto, fecha_gasto,
  metodo_pago, cash_movement_id, created_by, created_at
)
select
  cs.tienda_id,
  public.ensure_cash_expense_category(cs.tienda_id),
  cm.motivo,
  cm.amount,
  (cm.created_at at time zone coalesce(t.timezone, 'America/Bogota'))::date,
  'efectivo_caja',
  cm.id,
  cm.created_by,
  cm.created_at
from public.cash_movements cm
join public.cash_sessions cs on cs.id = cm.cash_session_id
join public.tiendas t on t.id = cs.tienda_id
where cm.tipo = 'expense'
  and cm.status = 'active'
  and not exists (
    select 1 from public.expenses e where e.cash_movement_id = cm.id
  );
