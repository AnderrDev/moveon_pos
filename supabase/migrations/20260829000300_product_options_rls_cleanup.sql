-- Corrige 8 hallazgos WARN del Security Advisor sobre public.product_options:
--
-- 1. "Auth RLS Initialization Plan" (x2): las políticas usaban auth.uid()
--    directo, que Postgres reevalúa por cada fila. Se envuelve en
--    (select auth.uid()) para que se evalúe una sola vez por consulta.
-- 2. "Multiple Permissive Policies" (x6, uno por rol): ni "po_read" ni
--    "po_admin_write" declaraban `to <rol>`, así que ambas aplicaban a
--    `public` (todos los roles) y "po_admin_write" era `for all` — que
--    incluye `select` y por tanto se solapaba con "po_read" para el mismo
--    rol/acción. La condición de "po_admin_write" (admin) ya es un
--    subconjunto de la de "po_read" (cualquier miembro activo de la tienda),
--    así que para SELECT era pura redundancia.
--
-- Fix: "po_admin_write" se divide en insert/update/delete (ya no toca
-- select, eliminando el solapamiento) y las cuatro políticas quedan
-- explícitamente `to authenticated` (anon nunca debió estar en el alcance).

drop policy if exists "po_admin_write" on public.product_options;
drop policy if exists "po_read" on public.product_options;

create policy "po_read" on public.product_options
  for select to authenticated
  using (
    exists (
      select 1 from public.user_tiendas
      where user_id   = (select auth.uid())
        and tienda_id = product_options.tienda_id
        and is_active = true
    )
  );

create policy "po_admin_insert" on public.product_options
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_tiendas
      where user_id   = (select auth.uid())
        and tienda_id = product_options.tienda_id
        and is_active = true
        and rol       = 'admin'
    )
  );

create policy "po_admin_update" on public.product_options
  for update to authenticated
  using (
    exists (
      select 1 from public.user_tiendas
      where user_id   = (select auth.uid())
        and tienda_id = product_options.tienda_id
        and is_active = true
        and rol       = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_tiendas
      where user_id   = (select auth.uid())
        and tienda_id = product_options.tienda_id
        and is_active = true
        and rol       = 'admin'
    )
  );

create policy "po_admin_delete" on public.product_options
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_tiendas
      where user_id   = (select auth.uid())
        and tienda_id = product_options.tienda_id
        and is_active = true
        and rol       = 'admin'
    )
  );
