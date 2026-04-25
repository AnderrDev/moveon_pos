-- ============================================================
-- SEED DE DESARROLLO — MOVEONAPP POS
-- Datos para desarrollo local únicamente
-- ============================================================

-- Nota: los usuarios se crean via Supabase Auth dashboard o CLI.
-- Este seed asume que ya existe un usuario con id conocido.

-- Tienda demo
insert into tiendas (id, nombre, nit, direccion, telefono)
values (
  '00000000-0000-0000-0000-000000000001',
  'MOVEONAPP Tienda Demo',
  '900.000.000-1',
  'Calle 1 # 2-3, Bogotá',
  '3001234567'
);

-- Para agregar usuarios: ejecutar después de crear el user en Auth
-- insert into user_tiendas (user_id, tienda_id, rol)
-- values ('<user-uuid-admin>', '00000000-0000-0000-0000-000000000001', 'admin');
