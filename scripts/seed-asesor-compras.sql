-- =====================================================================
-- Seed masivo para probar el asesor de compras — SOLO SUPABASE LOCAL
-- =====================================================================
--   pnpm seed:asesor            (psql contra 127.0.0.1:54322)
--
-- Simula 180 días de operación (hasta ayer) en la tienda demo local con
-- ~40 productos "SIM · ..." de perfiles de demanda distintos: estable, en
-- alza, en baja, picos de fin de semana, quincena, compras esporádicas,
-- lanzamientos recientes, productos descontinuados, una promoción, un
-- proveedor lento y un corte de suministro (agotados que pierden ventas).
-- Batidos y combos consumen ingredientes vía el trigger de componentes.
--
-- Guarda la demanda REAL de cada producto y día (incluida la perdida por
-- agotado) en `sim.daily_demand` para evaluar el pronóstico contra la verdad
-- (tests/backtest/purchase-advisor.backtest.ts).
--
-- Determinista (setseed). Idempotente: borra lo "SIM" anterior y lo recrea.
-- No toca los productos QA ni otros datos.
-- =====================================================================

\set ON_ERROR_STOP on

begin;

-- Fechas en hora de la tienda (current_date usa la zona de la sesión).
set local timezone = 'America/Bogota';

-- ---------- Guardia: solo la tienda demo local ----------
do $$
begin
  if not exists (
    select 1 from public.tiendas
    where id = '00000000-0000-0000-0000-000000000001' and nombre = 'MOVEONAPP Tienda Demo'
  ) or not exists (select 1 from auth.users where email = 'admin@moveon.local') then
    raise exception 'seed-asesor-compras: solo se ejecuta en el Supabase LOCAL (tienda demo + admin@moveon.local)';
  end if;
end $$;

-- Las ventas exigen que el cajero sea el usuario autenticado.
select set_config('request.jwt.claims', json_build_object('sub', id::text, 'email', email)::text, true)
from auth.users where email = 'admin@moveon.local';

select setseed(0.4242);

-- ---------- Limpieza de una corrida anterior ----------
create schema if not exists sim;
drop table if exists sim.daily_demand;
drop table if exists sim.products;

delete from public.inventory_movements
where producto_id in (select id from public.productos where nombre like 'SIM · %')
   or (referencia_tipo = 'sale' and referencia_id in (select id from public.sales where sale_number like 'SIM-%'));
delete from public.payments where sale_id in (select id from public.sales where sale_number like 'SIM-%');
delete from public.sale_items where sale_id in (select id from public.sales where sale_number like 'SIM-%');
delete from public.audit_logs where entity_id in (select id from public.sales where sale_number like 'SIM-%')
   or entity_id in (select id from public.productos where nombre like 'SIM · %');
delete from public.sales where sale_number like 'SIM-%';
delete from public.cash_sessions where notas_cierre = 'SIM';
delete from public.product_components where producto_id in (select id from public.productos where nombre like 'SIM · %');
delete from public.productos where nombre like 'SIM · %';
delete from public.proveedores where nombre like 'SIM · %';
delete from public.categorias where nombre like 'SIM · %';

-- ---------- Catálogo ----------
create table sim.products (
  code          text primary key,
  nombre        text not null,
  categoria     text not null,
  proveedor     text not null,
  tipo          public.product_type not null,
  costo         numeric not null,
  precio        numeric not null,
  stock_min     int not null,
  perfil        text not null,     -- steady | trend_up | trend_down | weekly | payday | lumpy | promo
  base          numeric not null,  -- unidades/día promedio
  launch_ago    int,               -- lanzado hace N días
  end_ago       int,               -- dejó de venderse hace N días
  lead_days     int not null default 1,
  visit_dow     int not null default 2,    -- día de pedido al proveedor (0 = domingo)
  cut_from_ago  int,               -- sin suministro entre cut_from_ago y cut_to_ago
  cut_to_ago    int,
  id            uuid
);

insert into sim.products (code, nombre, categoria, proveedor, tipo, costo, precio, stock_min, perfil, base, launch_ago, end_ago, lead_days, visit_dow, cut_from_ago, cut_to_ago) values
  ('WG2',  'SIM · Whey Gold 2lb',               'Proteínas',   'Distribuidora Fit', 'simple', 190000, 260000, 3, 'steady',     1.8,  null, null, 2, 2, null, null),
  ('WI5',  'SIM · Whey Isolate 5lb',            'Proteínas',   'Distribuidora Fit', 'simple', 420000, 560000, 1, 'weekly',     0.6,  null, null, 2, 2, null, null),
  ('WV2',  'SIM · Whey Vainilla 2lb',           'Proteínas',   'Distribuidora Fit', 'simple', 180000, 245000, 2, 'trend_up',   0.9,  null, null, 2, 2, null, null),
  ('PV',   'SIM · Proteína vegetal 2lb',        'Proteínas',   'Distribuidora Fit', 'simple', 150000, 210000, 1, 'trend_down', 0.7,  null, null, 2, 2, null, null),
  ('MG6',  'SIM · Mass gainer 6lb',             'Proteínas',   'Distribuidora Fit', 'simple', 230000, 310000, 1, 'lumpy',      0.25, null, null, 2, 2, null, null),
  ('WF2',  'SIM · Whey Fresa 2lb',              'Proteínas',   'Distribuidora Fit', 'simple', 185000, 250000, 2, 'payday',     1.0,  null, null, 2, 2, null, null),
  ('WC2',  'SIM · Whey Cookies 2lb',            'Proteínas',   'Importadora Lenta', 'simple', 195000, 265000, 2, 'steady',     1.2,  null, null, 10, 4, null, null),
  ('C300', 'SIM · Creatina 300g',               'Creatinas',   'Nutrimax',          'simple',  47000,  85000, 4, 'steady',     1.5,  null, null, 1, 3, null, null),
  ('C100', 'SIM · Creatina 100 serv',           'Creatinas',   'Nutrimax',          'simple',  59000, 110000, 3, 'weekly',     1.0,  null, null, 1, 3, null, null),
  ('CGM',  'SIM · Creatina gomitas',            'Creatinas',   'Nutrimax',          'simple',  52000,  95000, 2, 'steady',     1.2,  21,   null, 1, 3, null, null),
  ('CHC',  'SIM · Creatina HCL',                'Creatinas',   'Nutrimax',          'simple',  70000, 120000, 1, 'steady',     0.6,  null, 45,   1, 3, null, null),
  ('C500', 'SIM · Creatina monohidrato 500g',   'Creatinas',   'Nutrimax',          'simple',  78000, 135000, 2, 'steady',     0.9,  null, null, 1, 3, 75,   25),
  ('PC4',  'SIM · Pre-entreno C4 30 serv',      'Pre-entrenos','Nutrimax',          'simple',  94000, 145000, 2, 'payday',     0.9,  null, null, 1, 3, null, null),
  ('PPS',  'SIM · Pre-entreno Psycho',          'Pre-entrenos','Nutrimax',          'simple',  88000, 140000, 1, 'promo',      0.5,  null, null, 1, 3, null, null),
  ('P60',  'SIM · Pre-entreno 60 serv',         'Pre-entrenos','Nutrimax',          'simple', 120000, 180000, 1, 'steady',     0.4,  null, null, 1, 3, null, null),
  ('SPR',  'SIM · Sachet proteína',             'Sachets',     'Sachets Co',        'simple',   3500,   6000, 20, 'weekly',    12,   null, null, 1, 1, null, null),
  ('SPE',  'SIM · Sachet pre-entreno',          'Sachets',     'Sachets Co',        'simple',   3000,   5500, 15, 'weekly',    8,    null, null, 1, 1, null, null),
  ('SCR',  'SIM · Sachet creatina',             'Sachets',     'Sachets Co',        'simple',   2900,   5000, 10, 'steady',    6,    null, null, 1, 1, null, null),
  ('BCA',  'SIM · BCAA 30 serv',                'Aminos',      'Sachets Co',        'simple',  65000, 105000, 1, 'steady',     0.7,  null, null, 1, 1, null, null),
  ('GLU',  'SIM · Glutamina 300g',              'Aminos',      'Sachets Co',        'simple',  55000,  90000, 1, 'trend_up',   0.4,  null, null, 1, 1, null, null),
  ('BCH',  'SIM · Barra proteica chocolate',    'Snacks',      'Snacks Andinos',    'simple',   4500,   8500, 15, 'weekly',    9,    null, null, 1, 4, null, null),
  ('BCK',  'SIM · Barra proteica cookies',      'Snacks',      'Snacks Andinos',    'simple',   4500,   8500, 10, 'payday',    6,    null, null, 1, 4, null, null),
  ('GAL',  'SIM · Galleta proteica',            'Snacks',      'Snacks Andinos',    'simple',   3800,   7000, 10, 'steady',    5,    null, null, 1, 4, null, null),
  ('RTD',  'SIM · Bebida proteica RTD',         'Bebidas',     'Snacks Andinos',    'simple',   5200,   9500, 12, 'weekly',    7,    null, null, 1, 4, null, null),
  ('AGU',  'SIM · Agua 600ml',                  'Bebidas',     'Bebidas del Valle', 'simple',   1200,   2500, 30, 'weekly',    15,   null, null, 1, 5, null, null),
  ('ENE',  'SIM · Bebida energizante',          'Bebidas',     'Bebidas del Valle', 'simple',   3100,   6000, 12, 'weekly',    6,    null, null, 1, 5, null, null),
  ('SHK',  'SIM · Shaker 600ml',                'Accesorios',  'Accesorios Gym',    'simple',  12000,  25000, 2, 'lumpy',      0.5,  null, null, 3, 1, null, null),
  ('GUA',  'SIM · Guantes de gimnasio',         'Accesorios',  'Accesorios Gym',    'simple',  28000,  55000, 1, 'lumpy',      0.15, null, null, 3, 1, null, null),
  ('CIN',  'SIM · Cinturón de levantamiento',   'Accesorios',  'Accesorios Gym',    'simple',  60000, 120000, 1, 'lumpy',      0.05, null, null, 3, 1, null, null),
  ('MUL',  'SIM · Multivitamínico',             'Vitaminas',   'Nutrimax',          'simple',  42000,  75000, 1, 'steady',     0.5,  null, null, 1, 3, null, null),
  ('OME',  'SIM · Omega 3',                     'Vitaminas',   'Nutrimax',          'simple',  38000,  70000, 1, 'trend_down', 0.4,  null, null, 1, 3, null, null),
  ('COL',  'SIM · Colágeno hidrolizado',        'Vitaminas',   'Nutrimax',          'simple',  37000,  75000, 2, 'steady',     0.8,  35,   null, 1, 3, null, null),
  ('ISC',  'SIM · Proteína a granel (scoop)',   'Insumos batido','Distribuidora Fit','ingredient', 2500,  0,  40, 'derived',  0,    null, null, 1, 2, null, null),
  ('ILE',  'SIM · Leche porción',               'Insumos batido','Bebidas del Valle','ingredient',  900,  0,  30, 'derived',  0,    null, null, 1, 5, null, null),
  ('IBA',  'SIM · Banano',                      'Insumos batido','Bebidas del Valle','ingredient',  400,  0,  30, 'derived',  0,    null, null, 1, 5, null, null),
  ('IVA',  'SIM · Vaso 16oz',                   'Insumos batido','Accesorios Gym',   'ingredient',  300,  0,  50, 'derived',  0,    null, null, 3, 1, null, null),
  ('BPB',  'SIM · Batido proteína banano',      'Batidos',     'Preparados',        'prepared',  4100, 12000, 0, 'weekly',    14,   null, null, 1, 0, null, null),
  ('BMS',  'SIM · Batido mass',                 'Batidos',     'Preparados',        'prepared',  7100, 16000, 0, 'payday',    4,    null, null, 1, 0, null, null),
  ('BFR',  'SIM · Batido frutos rojos',         'Batidos',     'Preparados',        'prepared',  3700, 11000, 0, 'trend_up',  3,    null, null, 1, 0, null, null),
  ('CWC',  'SIM · Combo whey + creatina',       'Combos',      'Preparados',        'combo',   237000, 320000, 0, 'lumpy',     0.2,  null, null, 1, 0, null, null);

-- Proveedores, categorías y productos reales.
insert into public.proveedores (tienda_id, nombre)
select distinct '00000000-0000-0000-0000-000000000001'::uuid, 'SIM · ' || proveedor
from sim.products where tipo in ('simple', 'ingredient');

insert into public.categorias (tienda_id, nombre, orden)
select '00000000-0000-0000-0000-000000000001'::uuid, 'SIM · ' || categoria, 90 + row_number() over (order by categoria)
from (select distinct categoria from sim.products) c;

update sim.products set id = gen_random_uuid();

insert into public.productos (id, tienda_id, categoria_id, proveedor_id, nombre, sku, tipo, unidad, precio_venta, costo, iva_tasa, stock_minimo, is_active, created_at)
select
  s.id,
  '00000000-0000-0000-0000-000000000001',
  (select id from public.categorias c where c.nombre = 'SIM · ' || s.categoria and c.tienda_id = '00000000-0000-0000-0000-000000000001'),
  (select id from public.proveedores p where p.nombre = 'SIM · ' || s.proveedor and p.tienda_id = '00000000-0000-0000-0000-000000000001'),
  s.nombre,
  'SIM-' || s.code,
  s.tipo,
  'und',
  s.precio,
  s.costo,
  0,
  s.stock_min,
  s.end_ago is null,
  ((current_date - coalesce(s.launch_ago, 180))::timestamp + time '06:00') at time zone 'America/Bogota'
from sim.products s;

-- Recetas: batidos consumen ingredientes; el combo, productos vendibles.
insert into public.product_components (tienda_id, producto_id, componente_id, cantidad)
select '00000000-0000-0000-0000-000000000001', p.id, c.id, r.cantidad
from (values
  ('BPB', 'ISC', 1), ('BPB', 'ILE', 1), ('BPB', 'IBA', 1), ('BPB', 'IVA', 1),
  ('BMS', 'ISC', 2), ('BMS', 'ILE', 1), ('BMS', 'IBA', 2), ('BMS', 'IVA', 1),
  ('BFR', 'ISC', 1), ('BFR', 'ILE', 1), ('BFR', 'IVA', 1),
  ('CWC', 'WG2', 1), ('CWC', 'C300', 1)
) r(prod, comp, cantidad)
join sim.products p on p.code = r.prod
join sim.products c on c.code = r.comp;

create table sim.daily_demand (
  producto_id uuid not null,
  day         date not null,
  demand      int not null,     -- demanda real (lo que se habría vendido con stock)
  sold        int not null,     -- lo vendido (limitado por stock)
  stock_end   numeric not null,
  primary key (producto_id, day)
);

-- ---------- Simulación ----------
create or replace function pg_temp.sim_poisson(lambda float8) returns int
language plpgsql volatile as $$
declare
  l float8;
  k int := 0;
  p float8 := 1;
begin
  if lambda <= 0 then return 0; end if;
  if lambda > 30 then
    -- Aproximación normal para tasas altas.
    return greatest(0, round(lambda + sqrt(lambda) * sqrt(-2 * ln(greatest(random(), 1e-12))) * cos(2 * pi() * random())))::int;
  end if;
  l := exp(-lambda);
  loop
    k := k + 1;
    p := p * random();
    exit when p <= l;
  end loop;
  return k - 1;
end $$;

do $$
declare
  v_tienda   constant uuid := '00000000-0000-0000-0000-000000000001';
  v_user     uuid := (select id from auth.users where email = 'admin@moveon.local');
  v_days     constant int := 180;
  d          int;            -- días atrás (179 … 1)
  v_day      date;
  v_dow      int;
  v_dom      int;
  v_session  uuid;
  v_seq      int := 0;
  p          record;
  v_lambda   float8;
  v_factor   float8;
  v_demand   int;
  v_sold     int;
  v_stock    jsonb := '{}'::jsonb;  -- code → stock actual
  v_pending  jsonb := '[]'::jsonb;  -- pedidos en camino: {code, qty, arrive_ago, cost}
  v_lines    jsonb;
  v_line     jsonb;
  v_tickets  int;
  v_ticket   int;
  v_sale     uuid;
  v_total    numeric;
  v_ts       timestamptz;
  v_qty      int;
  v_cost     numeric;
  v_order    record;
  v_cash_day numeric;
  i          int;
  v_comp     record;
  v_ok       boolean;
  v_need     numeric;
  v_target   numeric;
begin
  -- Stock inicial de 30 días de demanda (insumos: 3 semanas de batidos).
  for p in select * from sim.products where tipo in ('simple', 'ingredient') loop
    v_qty := case
      when p.launch_ago is not null then 0
      when p.tipo = 'ingredient' then 0
      else ceil(p.base * 30)
    end;
    v_stock := v_stock || jsonb_build_object(p.code, v_qty);
    if v_qty > 0 then
      insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, created_by, created_at)
      values (v_tienda, p.id, 'entry', 'punto_venta', v_qty, p.costo, 'SIM inventario inicial', v_user,
              ((current_date - v_days)::timestamp + time '06:30') at time zone 'America/Bogota');
    end if;
  end loop;
  -- Insumos: tres semanas de consumo de batidos.
  v_stock := v_stock
    || jsonb_build_object('ISC', 560, 'ILE', 450, 'IBA', 520, 'IVA', 450);
  insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, created_by, created_at)
  select v_tienda, s.id, 'entry', 'punto_venta', (v_stock ->> s.code)::numeric, s.costo, 'SIM inventario inicial', v_user,
         ((current_date - v_days)::timestamp + time '06:30') at time zone 'America/Bogota'
  from sim.products s where s.tipo = 'ingredient';

  for d in reverse (v_days - 1)..1 loop
    v_day := current_date - d;
    v_dow := extract(dow from v_day)::int;
    v_dom := extract(day from v_day)::int;

    -- 1) Llegan pedidos.
    for v_order in select * from jsonb_to_recordset(v_pending) as x(code text, qty int, arrive_ago int, cost numeric) where arrive_ago = d loop
      v_stock := jsonb_set(v_stock, array[v_order.code], to_jsonb((v_stock ->> v_order.code)::numeric + v_order.qty));
      insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, created_by, metodo_pago, created_at)
      select v_tienda, s.id, 'entry', 'punto_venta', v_order.qty, v_order.cost, 'SIM compra a proveedor', v_user, 'transferencia',
             ((v_day)::timestamp + time '07:15') at time zone 'America/Bogota'
      from sim.products s where s.code = v_order.code;
    end loop;
    v_pending := coalesce((select jsonb_agg(e) from jsonb_array_elements(v_pending) e where (e ->> 'arrive_ago')::int <> d), '[]'::jsonb);

    -- Lanzamientos: primer pedido el día del lanzamiento.
    for p in select * from sim.products where launch_ago = d and tipo = 'simple' loop
      v_qty := ceil(p.base * 14);
      v_stock := jsonb_set(v_stock, array[p.code], to_jsonb(v_qty));
      insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, created_by, created_at)
      values (v_tienda, p.id, 'entry', 'punto_venta', v_qty, p.costo, 'SIM lanzamiento', v_user,
              ((v_day)::timestamp + time '07:00') at time zone 'America/Bogota');
    end loop;

    -- 2) Demanda y ventas del día.
    v_lines := '[]'::jsonb;
    for p in select * from sim.products where perfil <> 'derived' order by code loop
      v_factor := 1;
      if p.launch_ago is not null and d > p.launch_ago then v_factor := 0; end if;
      if p.launch_ago is not null and d <= p.launch_ago then
        v_factor := least(1, (p.launch_ago - d + 3) / 10.0);
      end if;
      if p.end_ago is not null and d <= p.end_ago then v_factor := 0; end if;

      v_factor := v_factor * case p.perfil
        when 'trend_up'   then 0.5 + 1.0 * (v_days - d) / v_days
        when 'trend_down' then 1.5 - 1.0 * (v_days - d) / v_days
        when 'weekly'     then (array[0.6, 1.3, 1.1, 1.0, 1.0, 0.9, 1.4])[v_dow + 1]
        when 'payday'     then case when v_dom between 15 and 18 or v_dom >= 30 or v_dom <= 3 then 1.6 else 0.85 end
        when 'promo'      then case when d between 50 and 60 then 3.0 else 1.0 end
        else 1
      end;

      v_lambda := p.base * v_factor;
      if p.perfil = 'lumpy' then
        v_demand := case when random() < v_lambda / 2.0 then 1 + floor(random() * 3)::int else 0 end;
      else
        v_demand := pg_temp.sim_poisson(v_lambda);
      end if;

      if p.tipo = 'simple' then
        v_sold := least(v_demand, greatest((v_stock ->> p.code)::numeric, 0)::int);
        v_stock := jsonb_set(v_stock, array[p.code], to_jsonb((v_stock ->> p.code)::numeric - v_sold));
      else
        -- Preparados y combos: se venden mientras alcancen los componentes.
        v_sold := 0;
        for i in 1..v_demand loop
          v_ok := true;
          for v_comp in
            select c.code, pc.cantidad from public.product_components pc
            join sim.products c on c.id = pc.componente_id where pc.producto_id = p.id
          loop
            if (v_stock ->> v_comp.code)::numeric < v_comp.cantidad then v_ok := false; end if;
          end loop;
          exit when not v_ok;
          for v_comp in
            select c.code, pc.cantidad from public.product_components pc
            join sim.products c on c.id = pc.componente_id where pc.producto_id = p.id
          loop
            v_stock := jsonb_set(v_stock, array[v_comp.code], to_jsonb((v_stock ->> v_comp.code)::numeric - v_comp.cantidad));
          end loop;
          v_sold := v_sold + 1;
        end loop;
      end if;

      if p.tipo = 'simple' then
        insert into sim.daily_demand values (p.id, v_day, v_demand, v_sold, (v_stock ->> p.code)::numeric);
      else
        insert into sim.daily_demand values (p.id, v_day, v_demand, v_sold, 0);
      end if;

      -- Líneas de venta de 1–2 unidades.
      while v_sold > 0 loop
        v_qty := least(v_sold, case when random() < 0.8 then 1 else 2 end);
        v_lines := v_lines || jsonb_build_object('code', p.code, 'qty', v_qty);
        v_sold := v_sold - v_qty;
      end loop;
    end loop;

    -- Demanda de insumos = lo que consumieron los batidos vendidos ese día.
    insert into sim.daily_demand
    select s.id, v_day,
           coalesce((select sum(dd.sold * pc.cantidad) from sim.daily_demand dd
                     join public.product_components pc on pc.producto_id = dd.producto_id and pc.componente_id = s.id
                     where dd.day = v_day), 0)::int,
           coalesce((select sum(dd.sold * pc.cantidad) from sim.daily_demand dd
                     join public.product_components pc on pc.producto_id = dd.producto_id and pc.componente_id = s.id
                     where dd.day = v_day), 0)::int,
           (v_stock ->> s.code)::numeric
    from sim.products s where s.tipo = 'ingredient';

    -- 3) Caja del día y tiquetes (1–3 líneas cada uno).
    v_session := gen_random_uuid();
    insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status, opened_at, closed_by, closed_at,
                                      actual_cash_amount, closing_withdrawal_amount, cash_left_amount, notas_cierre)
    values (v_session, v_tienda, v_user, 100000, 'closed',
            ((v_day)::timestamp + time '07:00') at time zone 'America/Bogota', v_user,
            ((v_day)::timestamp + time '21:30') at time zone 'America/Bogota', 100000, 0, 100000, 'SIM');

    v_tickets := greatest(1, ceil(jsonb_array_length(v_lines) / 1.7));
    v_cash_day := 0;
    for v_ticket in 1..v_tickets loop
      if not exists (select 1 from jsonb_array_elements(v_lines) with ordinality e(x, n) where (n - 1) % v_tickets = v_ticket - 1) then
        continue;
      end if;
      v_seq := v_seq + 1;
      v_sale := gen_random_uuid();
      v_ts := ((v_day)::timestamp + time '07:00' + (random() * interval '14 hours')) at time zone 'America/Bogota';
      select coalesce(sum((e.x ->> 'qty')::numeric * s.precio), 0) into v_total
      from jsonb_array_elements(v_lines) with ordinality e(x, n)
      join sim.products s on s.code = e.x ->> 'code'
      where (n - 1) % v_tickets = v_ticket - 1;

      insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at)
      values (v_sale, v_tienda, v_session, 'SIM-' || lpad(v_seq::text, 6, '0'), v_user, v_total, v_total, 'sim-' || v_seq, v_ts);

      for v_line in select e.x from jsonb_array_elements(v_lines) with ordinality e(x, n) where (n - 1) % v_tickets = v_ticket - 1 loop
        select * into p from sim.products where code = v_line ->> 'code';
        insert into public.sale_items (sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price, total, unit_cost)
        values (v_sale, p.id, p.nombre, 'SIM-' || p.code, (v_line ->> 'qty')::numeric, p.precio,
                (v_line ->> 'qty')::numeric * p.precio, p.costo);
        if p.tipo = 'simple' then
          insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, motivo, referencia_tipo, referencia_id, created_by, created_at)
          values (v_tienda, p.id, 'sale_exit', 'punto_venta', -((v_line ->> 'qty')::numeric), 'Venta SIM-' || lpad(v_seq::text, 6, '0'), 'sale', v_sale, v_user, v_ts);
        end if;
      end loop;

      insert into public.payments (sale_id, metodo, amount) values (v_sale, (case when random() < 0.55 then 'cash' else 'transfer' end)::public.payment_method, v_total);
    end loop;

    -- 4) Pedidos del dueño simulado (imperfecto a propósito): el día de visita
    --    de cada proveedor pide hasta 3 semanas de su promedio histórico si le
    --    quedan menos de ~10 días; no ve tendencias ni promociones.
    for p in select * from sim.products where tipo in ('simple', 'ingredient') and visit_dow = v_dow loop
      if p.end_ago is not null and d <= p.end_ago + 5 then continue; end if;
      if p.launch_ago is not null and d > p.launch_ago then continue; end if;
      if p.cut_from_ago is not null and d between p.cut_to_ago and p.cut_from_ago then continue; end if;
      if exists (select 1 from jsonb_array_elements(v_pending) e where e ->> 'code' = p.code) then continue; end if;
      v_need := case when p.tipo = 'ingredient'
        then coalesce((select avg(demand) from sim.daily_demand dd where dd.producto_id = p.id and dd.day > v_day - 28), 20)
        else p.base end;
      v_target := ceil(v_need * 21);
      if (v_stock ->> p.code)::numeric < v_need * 10 then
        -- El proveedor lento entrega pedidos pequeños.
        v_qty := greatest(1, (v_target - (v_stock ->> p.code)::numeric)::int);
        if p.lead_days >= 10 then v_qty := greatest(1, v_qty / 2); end if;
        v_cost := round(p.costo * (0.95 + random() * 0.1));
        v_pending := v_pending || jsonb_build_object('code', p.code, 'qty', v_qty, 'arrive_ago', greatest(0, d - p.lead_days), 'cost', v_cost);
      end if;
    end loop;
  end loop;

  -- El trigger de componentes registra la salida con now(): se lleva a la
  -- hora de la venta simulada.
  update public.inventory_movements m
  set created_at = sa.created_at
  from public.sales sa
  where m.referencia_tipo = 'sale' and m.referencia_id = sa.id
    and sa.sale_number like 'SIM-%' and m.created_at <> sa.created_at;

  -- La demanda real de los productos que van en el combo incluye la del combo.
  update sim.daily_demand dd
  set demand = dd.demand + x.demand, sold = dd.sold + x.sold
  from (
    select pc.componente_id, c.day, sum(c.demand * pc.cantidad)::int as demand, sum(c.sold * pc.cantidad)::int as sold
    from sim.daily_demand c
    join sim.products cp on cp.id = c.producto_id and cp.tipo = 'combo'
    join public.product_components pc on pc.producto_id = cp.id
    group by 1, 2
  ) x
  where dd.producto_id = x.componente_id and dd.day = x.day;

  -- Costo vigente = último costo de compra.
  update public.productos pr
  set costo = m.costo_unitario
  from (
    select distinct on (producto_id) producto_id, costo_unitario
    from public.inventory_movements
    where tipo = 'entry' and costo_unitario is not null and producto_id in (select id from sim.products)
    order by producto_id, created_at desc
  ) m
  where pr.id = m.producto_id;
end $$;

commit;

-- Resumen
select
  (select count(*) from public.productos where nombre like 'SIM · %') as productos,
  (select count(*) from public.sales where sale_number like 'SIM-%') as ventas,
  (select count(*) from public.sale_items si join public.sales s on s.id = si.sale_id where s.sale_number like 'SIM-%') as lineas,
  (select count(*) from public.inventory_movements where producto_id in (select id from sim.products)) as movimientos,
  (select sum(demand - sold) from sim.daily_demand) as unidades_perdidas_por_agotado;
