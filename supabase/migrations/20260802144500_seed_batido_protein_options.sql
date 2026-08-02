-- Opciones de proteína de los batidos (ADR 0017 / PLAN-71).
--
-- Regla comercial del dueño (2026-08-02):
--   * CH+       — por defecto, sin recargo. No descuenta inventario: se sirve
--                 del tarro y hoy no se mide por batido.
--   * Bipro     — +$2.000, consume 1 sachet de Bipro.
--   * Best Whey — +$1.000, consume 1 sachet de Best Whey.
--
-- Se resuelve por NOMBRE de producto y por tienda, así que es idempotente y
-- sirve igual en local que en el remoto. Si un sachet no existe en la tienda,
-- la opción queda sin componente (no descuenta) en vez de fallar: el admin la
-- puede mapear después desde el formulario del producto.

insert into public.product_options (
  tienda_id, producto_id, grupo, nombre, precio_extra,
  componente_id, componente_cantidad, es_default, orden
)
select
  p.tienda_id,
  p.id,
  'Proteína',
  o.nombre,
  o.precio_extra,
  c.id,
  case when c.id is null then 0 else o.cantidad end,
  o.es_default,
  o.orden
from public.productos p
cross join (values
  ('CH+',        0::numeric, null::text,                          0::numeric, true,  0),
  ('Bipro',      2000::numeric, 'BIPRO CLASSIC VAINILLA SACHET 26G', 1::numeric, false, 1),
  ('Best Whey',  1000::numeric, 'BEST WHEY VAINILLA SACHET',         1::numeric, false, 2)
) as o(nombre, precio_extra, componente, cantidad, es_default, orden)
left join lateral (
  select pc.id
  from public.productos pc
  where pc.tienda_id = p.tienda_id
    and pc.nombre = o.componente
    and pc.deleted_at is null
  limit 1
) c on true
where p.tipo = 'prepared'
  and p.deleted_at is null
  and p.nombre in ('BATIDO EN AGUA', 'BATIDO EN LECHE')
on conflict (producto_id, grupo, nombre) do nothing;
