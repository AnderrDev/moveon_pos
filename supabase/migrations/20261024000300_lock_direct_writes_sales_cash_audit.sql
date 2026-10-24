-- =====================================================
-- Bloquear escrituras directas a ventas, pagos, caja y auditoría (paso 2 de 2)
-- =====================================================
-- Hasta aquí sales, sale_items, payments, sale_counters, cash_movements,
-- cash_sessions y audit_logs solo tenían `tenant_isolation FOR ALL`, y
-- `authenticated` conservaba INSERT/UPDATE/DELETE (20260716000200). Cualquier
-- usuario activo de la tienda —un cajero— podía borrar o reescribir ventas,
-- pagos o la auditoría vía PostgREST, saltándose las RPC (auditoría
-- 2026-10-24, P0).
--
-- Tras esta migración:
--   * Lectura: igual que antes (misma condición de tienda, ahora solo SELECT).
--   * sales / sale_items / payments / sale_counters / cash_movements: sin
--     escritura directa; solo las RPC SECURITY DEFINER (*_atomic).
--   * cash_sessions: INSERT directo solo de una sesión abierta propia
--     (la policy RESTRICTIVE cash_sessions_open_insert_only se conserva);
--     sin UPDATE/DELETE.
--   * audit_logs: append-only. INSERT solo con user_id = auth.uid() en una
--     tienda propia; sin UPDATE/DELETE.
--
-- Requiere 20261024000200 (add_cash_movement_atomic y register_expense_atomic
-- DEFINER) y el frontend que ya usa add_cash_movement_atomic (paso 2 de 2).

-- 1. Policies: reemplazar `tenant_isolation FOR ALL` por solo SELECT con la
--    misma condición (copiada de pg_policies para no divergir entre entornos).
do $$
declare
  v_table text;
  v_qual  text;
begin
  foreach v_table in array array[
    'sales', 'sale_items', 'payments', 'sale_counters',
    'cash_movements', 'cash_sessions', 'audit_logs'
  ] loop
    select qual into v_qual
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table
      and policyname = 'tenant_isolation';

    if v_qual is null then
      raise exception 'Falta la policy tenant_isolation en %', v_table;
    end if;

    execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      v_table || '_select', v_table, v_qual
    );
    execute format('drop policy tenant_isolation on public.%I', v_table);
  end loop;
end $$;

-- 2. cash_sessions: apertura directa (la RESTRICTIVE ya exige status open,
--    opened_by = auth.uid() y campos de cierre vacíos).
drop policy if exists cash_sessions_open_insert on public.cash_sessions;
create policy cash_sessions_open_insert
  on public.cash_sessions
  for insert
  to authenticated
  with check (tienda_id in (select public.get_user_tiendas()));

-- 3. audit_logs: append-only con identidad forzada.
drop policy if exists audit_logs_insert_own on public.audit_logs;
create policy audit_logs_insert_own
  on public.audit_logs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and tienda_id in (select public.get_user_tiendas())
  );

-- 4. Privilegios de tabla.
revoke insert, update, delete, truncate on
  public.sales, public.sale_items, public.payments, public.sale_counters,
  public.cash_movements
from authenticated, anon;

revoke update, delete, truncate on public.cash_sessions, public.audit_logs
from authenticated, anon;

revoke insert on public.cash_sessions, public.audit_logs from anon;
