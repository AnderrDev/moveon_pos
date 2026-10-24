-- =====================================================
-- Corrección de pagos legacy + limpieza de combos_semana
-- =====================================================
-- Contexto: auditoría de base de datos 2026-09-04.
--
-- (A) V-000006 y V-000007 (15 de junio de 2026) quedaron con el pago en
-- efectivo registrado por el monto RECIBIDO (incluye vuelto) en vez del
-- monto de la venta. Es el bug ya corregido en create_sale_atomic (hoy resta
-- el vuelto antes de persistir payments); estos dos registros son anteriores
-- a esa corrección. correct_payment_atomic no sirve aquí: solo corrige
-- método de pago (no monto) y exige cash_session abierta; la de estas
-- ventas ya está cerrada. Se corrige con UPDATE directo + audit_logs.
--
-- (B) combos_semana: 3 filas activas ("Pack Inicio Gym", "Combo Fuerza &
-- Energía", "Batido Power + Proteína"), items como text[] sin FK a
-- productos. Verificado que ningún código de la app (pos-angular ni
-- landing-web) consulta esta tabla hoy -- el menú de Combos de la landing
-- vive hardcodeado en catalog-content.ts (contenido distinto, café/snacks)
-- desde el rediseño oficial del catálogo (2026-07-05). Es remanente del
-- diseño anterior (docs/sessions/2026-06-24-catalogo-publico.md), no
-- infraestructura en uso. Sin FKs entrantes, sin vistas que la referencien.
--
-- Contenido original de combos_semana antes del DROP, por si se retoma como
-- combos vendibles reales vía productos.tipo='combo' + product_components:
--   1. Pack Inicio Gym ($189.900, antes $230.000): WHEY GOLD STANDARD
--      CHOCOLATE 2LB, CREATINA MONO HEALTHY SPORT 50 SERV, BATIDO EN LECHE
--   2. Combo Fuerza & Energía ($119.900, antes $145.000): C4 ORIGINAL 30
--      SERV, CREATINA PLATINUM 90 SERV
--   3. Batido Power + Proteína ($29.900, antes $38.000): BATIDO EN LECHE,
--      BIPRO CLASSIC VAINILLA SACHET 26G

-- (A) Corrección auditada de los dos pagos legacy
with correcciones as (
  select * from (values
    ('36f8301e-2a01-4f98-bcc9-9075a9cdad7d'::uuid, 5000.00::numeric,  'V-000006'),
    ('728d75ad-14ec-4bbd-a7f3-b7ef5861672f'::uuid, 16500.00::numeric, 'V-000007')
  ) as t(payment_id, new_amount, sale_number)
),
old_values as (
  select p.id as payment_id, p.amount as old_amount, p.sale_id, s.tienda_id, s.sale_number
  from payments p
  join sales s on s.id = p.sale_id
  join correcciones c on c.payment_id = p.id
),
updated as (
  update payments p
  set amount = c.new_amount
  from correcciones c
  where p.id = c.payment_id
  returning p.id
)
insert into audit_logs (tienda_id, user_id, user_email, action, entity_type, entity_id, changes)
select
  ov.tienda_id,
  null,
  'system:data-fix-2026-09-04',
  'sale.payment_amount_corrected_legacy',
  'payment',
  ov.payment_id,
  jsonb_build_object(
    'old_amount', ov.old_amount,
    'new_amount', c.new_amount,
    'reason', 'Corrección de datos legacy: el pago en efectivo se registró por el monto recibido (incluye vuelto) en vez del monto de la venta, bug corregido en create_sale_atomic. Corrección auditada tras revisión de base de datos 2026-09-04.',
    'sale_id', ov.sale_id,
    'sale_number', ov.sale_number
  )
from old_values ov
join correcciones c on c.payment_id = ov.payment_id;

-- (B) combos_semana: sin uso en código actual, remanente del diseño previo
drop table if exists public.combos_semana;
