-- =====================================================
-- pgTAP: toda RPC que escribe en una tabla bloqueada es SECURITY DEFINER
-- =====================================================
--   supabase test db --local supabase/tests/definer-writes.test.sql
--
-- El P0 (20261024000300/000500) quitó a `authenticated` las escrituras
-- directas sobre ventas, caja, auditoría e inventario: solo se escribe por
-- RPC. Una RPC SECURITY INVOKER que escribe en esas tablas falla en runtime con
-- "permission denied" (pasó con create_product_with_initial_stock, corregida
-- en 20261024150000). Esta prueba detecta esa combinación por catálogo:
-- funciones ejecutables por authenticated, INVOKER, cuyo cuerpo hace
-- INSERT/UPDATE/DELETE sobre una tabla en la que authenticated no tiene ese
-- privilegio. Las funciones de trigger se excluyen (no se llaman directo).

begin;

create extension if not exists pgtap;

select plan(2);

create function pg_temp.invoker_writes_to_locked_tables()
returns table (function_name text, table_name text, privilege text)
language sql as $$
  with locked as (
    select c.relname::text, p.priv
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where n.nspname = 'public' and c.relkind = 'r'
      and not has_table_privilege('authenticated', c.oid, p.priv)
  ),
  fns as (
    select p.proname::text, p.prosrc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and not p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
  select f.proname, l.relname, l.priv
  from fns f
  join locked l on f.prosrc ~* case l.priv
    when 'INSERT' then '\minsert\s+into\s+(public\.)?' || l.relname || '\M'
    when 'UPDATE' then '\mupdate\s+(public\.)?' || l.relname || '\M'
    else '\mdelete\s+from\s+(public\.)?' || l.relname || '\M'
  end
$$;

select is_empty(
  $$ select * from pg_temp.invoker_writes_to_locked_tables() $$,
  'ninguna RPC SECURITY INVOKER escribe en tablas que authenticated no puede escribir'
);

-- Control: reproduce la regresión de 20261024000500 y comprueba que se detecta.
alter function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type, text, numeric, numeric, numeric,
  numeric, boolean, numeric, public.inventory_location, uuid, text, boolean
) security invoker;

select results_eq(
  $$ select function_name, table_name, privilege from pg_temp.invoker_writes_to_locked_tables() $$,
  $$ values ('create_product_with_initial_stock', 'inventory_movements', 'INSERT') $$,
  'control: detecta create_product_with_initial_stock como INVOKER'
);

select * from finish();

rollback;
