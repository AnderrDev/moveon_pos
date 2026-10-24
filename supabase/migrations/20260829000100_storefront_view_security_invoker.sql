-- Corrige el hallazgo "Security Definer View" (Critical, Supabase Security
-- Advisor) sobre storefront_productos_publicos.
--
-- La vista no declaraba security_invoker, así que corría con los permisos
-- de su dueño (comportamiento por defecto de Postgres) en vez de los del rol
-- que consulta -- eso le permite saltarse RLS. Se creó así en 20260710000200
-- porque RLS solo filtra filas, no columnas, y había que ocultarle
-- precio_venta/costo/sku a anon sin tocar el resto de columnas.
--
-- Se reemplaza el patrón "vista definer" por defensa en profundidad real:
--   1. Política RLS para anon en productos que replica el filtro de la vista.
--   2. GRANT SELECT por columna a anon (solo las columnas no sensibles).
--   3. security_invoker = true en la vista (ya no necesita privilegios de
--      dueño; Postgres aplica los permisos y RLS del rol que consulta).
--
-- De paso se revocan INSERT/UPDATE/REFERENCES de anon sobre productos:
-- privilegios de tabla heredados de los defaults iniciales que RLS ya
-- bloqueaba (no había política ALL/INSERT/UPDATE para anon), pero no hay
-- razón para que existan y no conviene depender solo de RLS para eso.

create policy "catalogo: anon puede leer productos publicos"
  on public.productos for select to anon
  using (
    is_active = true
    and deleted_at is null
    and tipo not in ('ingredient', 'combo')
  );

grant select (
  id, nombre, tipo, para_que_sirve, image_url, marca, etiqueta, categoria_id
) on public.productos to anon;

revoke insert, update, references on public.productos from anon;

create or replace view public.storefront_productos_publicos
  with (security_invoker = true) as
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
  and p.tipo not in ('ingredient', 'combo');

comment on view public.storefront_productos_publicos is
  'Vista pública del catálogo de suplementos (security_invoker=true desde 2026-08-29, ADR pendiente: ver docs/sessions/2026-08-29-bug-blank-screen-refresh-token.md). No expone precio_venta, costo, SKU ni códigos internos. Excluye ingredientes y combos (los combos se venden solo en el POS).';
