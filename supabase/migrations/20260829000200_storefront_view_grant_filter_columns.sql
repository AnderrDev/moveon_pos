-- Fix de 20260829000100: la vista storefront_productos_publicos filtra por
-- p.is_active y p.deleted_at en el WHERE. Postgres exige privilegio SELECT
-- sobre cualquier columna referenciada en la consulta (no solo las que se
-- devuelven), así que sin este grant la vista falla con
-- "permission denied for table productos" para anon aunque las columnas
-- expuestas sí estuvieran otorgadas. Ninguna de las dos es sensible
-- (booleano / timestamp de borrado lógico).

grant select (is_active, deleted_at) on public.productos to anon;
