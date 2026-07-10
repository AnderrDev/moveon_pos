-- Catálogo público sin precios de suplementos.
-- La landing debe consumir esta vista para que `precio_venta` no viaje al browser.

drop view if exists public.storefront_productos_publicos;

create view public.storefront_productos_publicos as
select
  p.id,
  p.nombre,
  p.tipo,
  p.para_que_sirve,
  p.image_url,
  p.marca,
  p.etiqueta,
  p.categoria_id,
  c.nombre as categoria_nombre,
  c.orden as categoria_orden
from public.productos p
left join public.categorias c
  on c.id = p.categoria_id
 and c.is_active = true
where p.is_active = true
  and p.deleted_at is null
  and p.tipo <> 'ingredient';

comment on view public.storefront_productos_publicos is
  'Vista pública del catálogo de suplementos. No expone precio_venta, costo, SKU ni códigos internos.';

drop policy if exists "catalogo: anon puede leer productos activos" on public.productos;

revoke select on public.productos from public;
revoke select on public.productos from anon;
grant select on public.productos to authenticated;

revoke all on public.storefront_productos_publicos from public;
grant select on public.storefront_productos_publicos to anon, authenticated;
