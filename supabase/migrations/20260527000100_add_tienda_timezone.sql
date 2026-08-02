-- Zona horaria de la tienda para reportes por día calendario local.
-- El reporte diario filtra ventas/sesiones por el día local de la tienda
-- (default America/Bogota, UTC−5) en lugar del día UTC.
alter table tiendas
  add column if not exists timezone text not null default 'America/Bogota';

comment on column tiendas.timezone is
  'Zona horaria IANA de la tienda (ej. America/Bogota). Usada para calcular el día calendario local en reportes. created_at se sigue guardando en UTC.';
