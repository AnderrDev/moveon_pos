-- 20260721_001: RPC get_stock_levels
-- Bug: la página de inventario sumaba inventory_movements en el cliente,
-- pero PostgREST limita cada consulta a 1000 filas; al superar ese número
-- los movimientos más recientes quedaban fuera de la suma y el stock
-- mostrado no cambiaba. Este RPC agrega el stock por producto/ubicación
-- en el servidor (mismo patrón que get_stock, que ya suma en SQL).

create or replace function public.get_stock_levels(p_tienda_id uuid)
returns table (
  producto_id uuid,
  punto_venta_stock numeric,
  bodega_stock numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    m.producto_id,
    coalesce(sum(m.cantidad) filter (where m.ubicacion = 'punto_venta'), 0) as punto_venta_stock,
    coalesce(sum(m.cantidad) filter (where m.ubicacion = 'bodega'), 0) as bodega_stock
  from public.inventory_movements m
  where m.tienda_id = p_tienda_id
  group by m.producto_id;
$$;
