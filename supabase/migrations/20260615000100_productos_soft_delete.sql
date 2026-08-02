-- Soft delete para productos: guarda la marca de tiempo pero conserva el historial
alter table productos add column if not exists deleted_at timestamptz default null;
