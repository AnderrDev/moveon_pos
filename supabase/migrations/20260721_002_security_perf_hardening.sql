-- 20260721_002: hardening de seguridad y performance (hallazgos de auditoría + advisors)
-- Ver docs/sessions/2026-07-21-bug-ajuste-inventario-galletas.md §8.

-- 1. search_path fijo en funciones que no lo tenían (advisor 0011)
alter function public.register_expense_atomic(uuid, uuid, text, numeric, text, uuid, text, date, text)
  set search_path = public;
alter function public.get_reinvestment_fund_totals(uuid, timestamptz, timestamptz, timestamptz)
  set search_path = public;

-- 2. Las funciones de trigger no deben ser invocables vía REST (advisors 0028/0029)
revoke execute on function public.tg_audit_sale_discount() from public, anon, authenticated;
revoke execute on function public.tg_consume_sale_components() from public, anon, authenticated;
revoke execute on function public.tg_audit_inventory_adjustment() from public, anon, authenticated;
revoke execute on function public.tg_audit_producto_price() from public, anon, authenticated;
revoke execute on function public.enforce_sale_cashier_identity() from public, anon, authenticated;
revoke execute on function public.update_updated_at() from public, anon, authenticated;

-- 3. Índice duplicado en audit_logs (advisor 0009): se conserva audit_logs_tienda_created
drop index if exists public.ix_audit_logs_tienda_created;

-- 4. Policy SELECT redundante en audit_logs (advisor 0006): tenant_isolation (ALL) ya cubre lectura
drop policy if exists tenant_select on public.audit_logs;

-- 5. RLS initplan (advisor 0003): auth.uid() envuelto en (select ...) para evaluarse una vez
--    por consulta y no por fila. Además pc_admin_write (ALL) se divide en insert/update/delete
--    para eliminar la doble policy permisiva de SELECT (advisor 0006).
drop policy if exists pc_read on public.product_components;
create policy pc_read on public.product_components
  for select to authenticated
  using (exists (
    select 1 from user_tiendas ut
    where ut.user_id = (select auth.uid())
      and ut.tienda_id = product_components.tienda_id
      and ut.is_active = true
  ));

drop policy if exists pc_admin_write on public.product_components;
create policy pc_admin_insert on public.product_components
  for insert to authenticated
  with check (exists (
    select 1 from user_tiendas ut
    where ut.user_id = (select auth.uid())
      and ut.tienda_id = product_components.tienda_id
      and ut.is_active = true
      and ut.rol = 'admin'
  ));
create policy pc_admin_update on public.product_components
  for update to authenticated
  using (exists (
    select 1 from user_tiendas ut
    where ut.user_id = (select auth.uid())
      and ut.tienda_id = product_components.tienda_id
      and ut.is_active = true
      and ut.rol = 'admin'
  ))
  with check (exists (
    select 1 from user_tiendas ut
    where ut.user_id = (select auth.uid())
      and ut.tienda_id = product_components.tienda_id
      and ut.is_active = true
      and ut.rol = 'admin'
  ));
create policy pc_admin_delete on public.product_components
  for delete to authenticated
  using (exists (
    select 1 from user_tiendas ut
    where ut.user_id = (select auth.uid())
      and ut.tienda_id = product_components.tienda_id
      and ut.is_active = true
      and ut.rol = 'admin'
  ));

-- 6. Igual para las policies de loyalty. Guardado con to_regclass porque las migraciones
--    de loyalty (20260716*) viven en la rama dev: en un reset local desde main estas
--    tablas no existen y el bloque debe ser un no-op.
do $$
declare
  t text;
  pol text;
begin
  foreach t in array array['loyalty_accounts', 'loyalty_transactions', 'loyalty_rewards'] loop
    if to_regclass('public.' || t) is not null then
      pol := 'read_own_tienda_' || t;
      execute format('drop policy if exists %I on public.%I', pol, t);
      execute format(
        'create policy %I on public.%I for select to authenticated using (
           tienda_id in (
             select ut.tienda_id from user_tiendas ut
             where ut.user_id = (select auth.uid()) and ut.is_active = true
           )
         )', pol, t);
    end if;
  end loop;
end $$;

-- 7. Storage: el bucket product-images es público (las imágenes se sirven por URL pública,
--    que no pasa por RLS), pero la policy SELECT amplia permitía a cualquiera LISTAR el
--    bucket vía API (advisor 0025). Se restringe la lectura por API a admins activos;
--    la app solo usa upload/getPublicUrl/remove, nada se rompe.
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );
