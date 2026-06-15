-- Tabla de auditoría: registra quién hizo qué y cuándo en entidades clave.
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  tienda_id    uuid not null,
  user_id      uuid not null,
  user_email   text not null default '',
  entity_type  text not null,  -- 'producto' | 'venta' | 'movimiento_inventario' | 'sesion_caja'
  entity_id    text not null default '',
  entity_label text,           -- nombre legible (ej: nombre del producto, número de venta)
  action       text not null,  -- 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'void' | 'open' | 'close' | 'entry' | 'adjust' | 'transfer'
  changes      jsonb,          -- patch de campos o snapshot según el tipo de acción
  created_at   timestamptz not null default now()
);

alter table audit_logs enable row level security;

create policy "tenant_isolation" on audit_logs for all
  using (tienda_id in (select get_user_tiendas()));

create index audit_logs_tienda_created on audit_logs (tienda_id, created_at desc);
create index audit_logs_entity on audit_logs (tienda_id, entity_type, entity_id);
