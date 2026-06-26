-- ============================================================
-- CATÁLOGO PÚBLICO — MOVEONAPP POS
-- Habilita lectura anon en productos y categorías,
-- crea tabla combos_semana con RLS y siembra combos de ejemplo.
-- ============================================================

-- RLS anon READ-ONLY en productos activos (no eliminados)
create policy "catalogo: anon puede leer productos activos"
  on public.productos for select to anon
  using (is_active = true and deleted_at is null);

-- RLS anon READ-ONLY en categorías activas
create policy "catalogo: anon puede leer categorias activas"
  on public.categorias for select to anon
  using (is_active = true);

-- ─── Tabla combos_semana ─────────────────────────────────────────────────────
create table public.combos_semana (
  id             uuid          primary key default gen_random_uuid(),
  tienda_id      uuid          not null references public.tiendas(id) on delete cascade,
  nombre         text          not null,
  descripcion    text,
  precio         numeric(14,2) not null,
  precio_original numeric(14,2),       -- precio sin descuento (para mostrar tachado)
  etiqueta       text,                 -- ej: "🔥 MÁS POPULAR", "⚡ COMBO SEMANA"
  items          text[]        not null default '{}',  -- nombres de productos incluidos
  is_active      boolean       not null default true,
  vigente_hasta  date,
  orden          int           not null default 0,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

alter table public.combos_semana enable row level security;

create policy "combos: autenticados administran su tienda"
  on public.combos_semana for all to authenticated
  using (tienda_id in (select get_user_tiendas()));

create policy "combos: anon puede leer activos"
  on public.combos_semana for select to anon
  using (is_active = true);

create trigger tg_combos_semana_updated_at
  before update on public.combos_semana
  for each row execute function update_updated_at_column();

-- ─── Combos de ejemplo ────────────────────────────────────────────────────────
insert into public.combos_semana
  (tienda_id, nombre, descripcion, precio, precio_original, etiqueta, items, orden)
values
  (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'Pack Inicio Gym',
    'Todo lo que necesitas para empezar: proteína + creatina + batido de bienvenida',
    189900, 230000, '🔥 MÁS POPULAR',
    ARRAY['WHEY GOLD STANDARD CHOCOLATE 2LB', 'CREATINA MONO HEALTHY SPORT 50 SERV', 'BATIDO EN LECHE'],
    10
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'Combo Fuerza & Energía',
    'Pre-entreno + creatina para entrenamientos explosivos',
    119900, 145000, '⚡ COMBO SEMANA',
    ARRAY['C4 ORIGINAL 30 SERV', 'CREATINA PLATINUM 90 SERV'],
    20
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'Batido Power + Proteína',
    'Batido personalizado en leche + proteína en sachet para llevar',
    29900, 38000, '🥤 ESPECIAL DEL DÍA',
    ARRAY['BATIDO EN LECHE', 'BIPRO CLASSIC VAINILLA SACHET 26G'],
    30
  );
