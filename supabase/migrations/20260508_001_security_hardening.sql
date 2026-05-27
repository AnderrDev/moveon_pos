-- =====================================================
-- Hardening de seguridad y RLS — auditoría 2026-05-08
-- =====================================================
-- Cierra hallazgos del Database Linter:
--   S1 — revoca EXECUTE en funciones SECURITY DEFINER del rol anon/public
--   S2 — fija search_path en funciones que no lo tenían (function_search_path_mutable)
--   S3 — restringe policies a `to authenticated` (en lugar de `public`)
--   P1 — usa `(select auth.uid())` en lugar de `auth.uid()` (auth_rls_initplan)
--
-- Cambios idempotentes y aditivos. Verificado con `get_advisors` antes/después.
-- =====================================================

-- ---------- S2: search_path en funciones ----------

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_user_tiendas()
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select tienda_id
  from public.user_tiendas
  where user_id = auth.uid()
    and is_active = true;
$$;

create or replace function public.get_stock(p_producto_id uuid, p_tienda_id uuid)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(cantidad), 0)
  from public.inventory_movements
  where producto_id = p_producto_id
    and tienda_id   = p_tienda_id;
$$;

-- ---------- S1: privilegios mínimos ----------

revoke execute on function public.get_user_tiendas()                            from public, anon;
revoke execute on function public.void_sale_atomic(uuid, uuid, uuid, text)      from public, anon;
revoke execute on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
)                                                                                from public, anon;
revoke execute on function public.get_stock(uuid, uuid)                         from public, anon;

grant execute on function public.get_user_tiendas()                             to authenticated;
grant execute on function public.void_sale_atomic(uuid, uuid, uuid, text)       to authenticated;
grant execute on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid,
  numeric, numeric, numeric, numeric,
  text, jsonb, jsonb
)                                                                                to authenticated;
grant execute on function public.get_stock(uuid, uuid)                          to authenticated;

-- ---------- S3 + P1: recrear policies con `to authenticated` y `(select auth.uid())` ----------

-- tiendas
drop policy if exists "tenant_select" on public.tiendas;
create policy "tenant_select" on public.tiendas
  for select to authenticated
  using (
    id in (
      select tienda_id from public.user_tiendas
      where user_id = (select auth.uid()) and is_active = true
    )
  );

-- user_tiendas
drop policy if exists "own_rows_select" on public.user_tiendas;
create policy "own_rows_select" on public.user_tiendas
  for select to authenticated
  using (user_id = (select auth.uid()));

-- audit_logs
drop policy if exists "tenant_select" on public.audit_logs;
create policy "tenant_select" on public.audit_logs
  for select to authenticated
  using (
    tienda_id in (
      select tienda_id from public.user_tiendas
      where user_id = (select auth.uid()) and is_active = true
    )
  );

-- categorias
drop policy if exists "tenant_isolation" on public.categorias;
create policy "tenant_isolation" on public.categorias
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- productos
drop policy if exists "tenant_isolation" on public.productos;
create policy "tenant_isolation" on public.productos
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- inventory_movements
drop policy if exists "tenant_isolation" on public.inventory_movements;
create policy "tenant_isolation" on public.inventory_movements
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- clientes
drop policy if exists "tenant_isolation" on public.clientes;
create policy "tenant_isolation" on public.clientes
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- cash_sessions
drop policy if exists "tenant_isolation" on public.cash_sessions;
create policy "tenant_isolation" on public.cash_sessions
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- cash_movements (vía cash_sessions)
drop policy if exists "tenant_isolation" on public.cash_movements;
create policy "tenant_isolation" on public.cash_movements
  for all to authenticated
  using (
    cash_session_id in (
      select id from public.cash_sessions
      where tienda_id in (select public.get_user_tiendas())
    )
  );

-- billing_documents
drop policy if exists "tenant_isolation" on public.billing_documents;
create policy "tenant_isolation" on public.billing_documents
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- sales
drop policy if exists "tenant_isolation" on public.sales;
create policy "tenant_isolation" on public.sales
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

-- sale_items (vía sales)
drop policy if exists "tenant_isolation" on public.sale_items;
create policy "tenant_isolation" on public.sale_items
  for all to authenticated
  using (
    sale_id in (
      select id from public.sales
      where tienda_id in (select public.get_user_tiendas())
    )
  );

-- payments (vía sales)
drop policy if exists "tenant_isolation" on public.payments;
create policy "tenant_isolation" on public.payments
  for all to authenticated
  using (
    sale_id in (
      select id from public.sales
      where tienda_id in (select public.get_user_tiendas())
    )
  );

-- billing_events (vía billing_documents)
drop policy if exists "tenant_isolation" on public.billing_events;
create policy "tenant_isolation" on public.billing_events
  for all to authenticated
  using (
    billing_document_id in (
      select id from public.billing_documents
      where tienda_id in (select public.get_user_tiendas())
    )
  );

-- settings
drop policy if exists "tenant_isolation" on public.settings;
create policy "tenant_isolation" on public.settings
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));
