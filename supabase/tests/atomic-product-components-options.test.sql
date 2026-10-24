-- =====================================================
-- pgTAP: recetas y opciones de producto atómicas
-- =====================================================
-- Requiere 20261024000600 y 20261024000700.
--   supabase test db --local supabase/tests/atomic-product-components-options.test.sql
-- Se ejecuta como `authenticated` (lo que usa el cliente con su JWT).

begin;

create extension if not exists pgtap;

select plan(28);

do $$
declare
  v_tienda uuid := 'e1111111-1111-4111-8111-111111111111';
  v_otra   uuid := 'e1111111-1111-4111-8111-111111111112';
  v_admin  uuid := 'e2222222-2222-4222-8222-222222222221';
  v_cajero uuid := 'e2222222-2222-4222-8222-222222222222';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin,  'pgtap-recipe-admin@local.test',  '{}'::jsonb),
    (v_cajero, 'pgtap-recipe-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre) values (v_tienda, 'pgTAP recetas'), (v_otra, 'pgTAP otra');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin,  v_tienda, 'admin',  true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
    ('e3333333-3333-4333-8333-333333333331', v_tienda, 'Batido',  'prepared',   15000, null,  0, 0, true),
    ('e3333333-3333-4333-8333-333333333332', v_tienda, 'Combo',   'combo',     150000, null,  0, 0, true),
    ('e3333333-3333-4333-8333-333333333333', v_tienda, 'Whey',    'simple',     90000, 50000, 0, 0, true),
    ('e3333333-3333-4333-8333-333333333334', v_tienda, 'Leche',   'ingredient',  3000, 2000,  0, 0, true),
    ('e3333333-3333-4333-8333-333333333335', v_otra,   'Ajeno',   'simple',     10000, 5000,  0, 0, true);
end $$;

select set_config('request.jwt.claim.sub', 'e2222222-2222-4222-8222-222222222221', true);
set local role authenticated;

-- ── Componentes ─────────────────────────────────────────────────────────
select is(
  public.save_product_components_atomic(
    'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
    '[{"componente_id":"e3333333-3333-4333-8333-333333333334","cantidad":0.2},
      {"componente_id":"e3333333-3333-4333-8333-333333333333","cantidad":1}]'::jsonb),
  2, 'admin guarda la receta del batido'
);

select is(
  public.save_product_components_atomic(
    'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
    '[{"componente_id":"e3333333-3333-4333-8333-333333333334","cantidad":0.3}]'::jsonb),
  1, 'reemplazar la receta deja solo los componentes nuevos'
);

select is(
  (select cantidad::numeric from public.product_components
   where producto_id = 'e3333333-3333-4333-8333-333333333331'),
  0.3, 'la cantidad quedó actualizada'
);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"componente_id":"e3333333-3333-4333-8333-333333333333","cantidad":1},
         {"componente_id":"e3333333-3333-4333-8333-333333333331","cantidad":1}]'::jsonb) $$,
  'Un producto no puede ser componente de sí mismo', 'rechaza el producto como su propio componente'
);

select is(
  (select count(*)::int from public.product_components
   where producto_id = 'e3333333-3333-4333-8333-333333333331'),
  1, 'si el guardado falla, la receta anterior queda intacta (atómico)'
);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333332', 'e1111111-1111-4111-8111-111111111111',
       '[{"componente_id":"e3333333-3333-4333-8333-333333333331","cantidad":1}]'::jsonb) $$,
  'Un preparado o combo no puede ser componente', 'un preparado no puede ser componente de un combo'
);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333332', 'e1111111-1111-4111-8111-111111111111',
       '[{"componente_id":"e3333333-3333-4333-8333-333333333335","cantidad":1}]'::jsonb) $$,
  'Componente no encontrado', 'rechaza componentes de otra tienda'
);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333332', 'e1111111-1111-4111-8111-111111111111',
       '[{"componente_id":"e3333333-3333-4333-8333-333333333333","cantidad":1},
         {"componente_id":"e3333333-3333-4333-8333-333333333333","cantidad":2}]'::jsonb) $$,
  'Hay componentes repetidos', 'rechaza componentes repetidos'
);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333332', 'e1111111-1111-4111-8111-111111111111',
       '[{"componente_id":"e3333333-3333-4333-8333-333333333333","cantidad":0}]'::jsonb) $$,
  'Cada componente necesita producto y cantidad mayor a 0', 'rechaza cantidad cero'
);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333333', 'e1111111-1111-4111-8111-111111111111',
       '[{"componente_id":"e3333333-3333-4333-8333-333333333334","cantidad":1}]'::jsonb) $$,
  'Solo los preparados y combos tienen componentes', 'un producto simple no lleva receta'
);

select is(
  public.save_product_components_atomic(
    'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111', '[]'::jsonb),
  0, 'guardar una receta vacía la limpia'
);

-- ── Opciones ────────────────────────────────────────────────────────────
select is(
  public.save_product_options_atomic(
    'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
    '[{"grupo":"Proteína","nombre":"Whey","precio_extra":3000,"componente_id":"e3333333-3333-4333-8333-333333333333","componente_cantidad":0.03,"es_default":true},
      {"grupo":"Proteína","nombre":"Vegana","precio_extra":4000,"componente_id":null,"componente_cantidad":0,"es_default":false}]'::jsonb),
  2, 'admin guarda dos opciones'
);

create temp table opt_whey_id on commit drop as
  select id from public.product_options
  where producto_id = 'e3333333-3333-4333-8333-333333333331' and nombre = 'Whey';

select lives_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"grupo":"Proteína","nombre":"Whey","precio_extra":3000,"componente_id":"e3333333-3333-4333-8333-333333333333","componente_cantidad":0.03,"es_default":false},
         {"grupo":"Proteína","nombre":"Vegana","precio_extra":4500,"componente_id":null,"componente_cantidad":0,"es_default":true}]'::jsonb) $$,
  'cambiar la opción por defecto no choca con el índice único'
);

select is(
  (select nombre from public.product_options
   where producto_id = 'e3333333-3333-4333-8333-333333333331' and es_default and is_active),
  'Vegana', 'la nueva predeterminada es Vegana'
);

select is(
  (select precio_extra::numeric from public.product_options
   where producto_id = 'e3333333-3333-4333-8333-333333333331' and nombre = 'Vegana'),
  4500::numeric, 'el recargo se actualizó'
);

select lives_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"grupo":"Proteína","nombre":"Vegana","precio_extra":4500,"componente_id":null,"componente_cantidad":0,"es_default":true}]'::jsonb) $$,
  'quitar una opción'
);

select is(
  (select is_active from public.product_options where id = (select id from opt_whey_id)),
  false, 'la opción quitada se desactiva y conserva su id (ventas pasadas la referencian)'
);

select lives_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"grupo":"Proteína","nombre":"Whey","precio_extra":3000,"componente_id":"e3333333-3333-4333-8333-333333333333","componente_cantidad":0.03,"es_default":false},
         {"grupo":"Proteína","nombre":"Vegana","precio_extra":4500,"componente_id":null,"componente_cantidad":0,"es_default":true}]'::jsonb) $$,
  'volver a agregar una opción quitada'
);

select is(
  (select is_active from public.product_options where id = (select id from opt_whey_id)),
  true, 'se reactiva la misma fila, no se crea otra'
);

-- Regresión: con el upsert del cliente, mover el default a una opción que va
-- ANTES en la lista que la predeterminada actual chocaba con
-- ux_product_options_default (la nueva se marcaba antes de desmarcar la vieja).
select lives_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"grupo":"Proteína","nombre":"Whey","precio_extra":3000,"componente_id":"e3333333-3333-4333-8333-333333333333","componente_cantidad":0.03,"es_default":true},
         {"grupo":"Proteína","nombre":"Vegana","precio_extra":4500,"componente_id":null,"componente_cantidad":0,"es_default":false}]'::jsonb) $$,
  'mover el default a una opción anterior en la lista no choca'
);

select is(
  (select nombre from public.product_options
   where producto_id = 'e3333333-3333-4333-8333-333333333331' and es_default and is_active),
  'Whey', 'la predeterminada vuelve a ser Whey'
);

select throws_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"grupo":"Proteína","nombre":"Whey","precio_extra":0,"componente_id":null,"componente_cantidad":0,"es_default":true},
         {"grupo":"Proteína","nombre":"Vegana","precio_extra":0,"componente_id":null,"componente_cantidad":0,"es_default":true}]'::jsonb) $$,
  'Solo una opción puede ser la predeterminada', 'rechaza dos predeterminadas'
);

select throws_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111',
       '[{"grupo":"Proteína","nombre":"Combo","precio_extra":0,"componente_id":"e3333333-3333-4333-8333-333333333332","componente_cantidad":1,"es_default":false}]'::jsonb) $$,
  'Una opción no puede consumir un preparado o combo', 'una opción no consume un combo'
);

select throws_ok(
  $$ select public.save_product_options_atomic(
       'e3333333-3333-4333-8333-333333333332', 'e1111111-1111-4111-8111-111111111111', '[]'::jsonb) $$,
  'Solo los preparados tienen opciones de venta', 'un combo no lleva opciones'
);

select is(
  (select count(*)::int from public.audit_logs
   where entity_id = 'e3333333-3333-4333-8333-333333333331'
     and action in ('product.components_saved', 'product.options_saved')),
  8, 'cada guardado exitoso queda auditado'
);

-- ── Cajero ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'e2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$ select public.save_product_components_atomic(
       'e3333333-3333-4333-8333-333333333331', 'e1111111-1111-4111-8111-111111111111', '[]'::jsonb) $$,
  'Solo el admin puede editar la receta de un producto', 'cajero no edita recetas'
);

-- ── Escritura directa (paso 2) ──────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'e2222222-2222-4222-8222-222222222221', true);

select throws_ok(
  $$ insert into public.product_components (tienda_id, producto_id, componente_id, cantidad)
     values ('e1111111-1111-4111-8111-111111111111', 'e3333333-3333-4333-8333-333333333332',
             'e3333333-3333-4333-8333-333333333333', 1) $$,
  '42501', null, 'ni el admin inserta componentes directo'
);

select throws_ok(
  $$ update public.product_options set es_default = true
     where producto_id = 'e3333333-3333-4333-8333-333333333331' $$,
  '42501', null, 'ni el admin modifica opciones directo'
);

select * from finish();

rollback;
