-- ============================================================
-- MIGRACIÓN — Módulo de Finanzas (gastos del negocio)
-- Tablas: empleados, expense_categories, expenses, expense_templates
-- Acceso: solo admin (RLS por rol). Sin borrado físico de gastos:
-- se anulan con auditoría (status = 'voided').
-- ============================================================

-- ==================== EMPLEADOS ====================

create table empleados (
  id               uuid          primary key default gen_random_uuid(),
  tienda_id        uuid          not null references tiendas(id) on delete cascade,
  nombre           text          not null,
  cargo            text,
  salario_mensual  numeric(14,2) not null default 0 check (salario_mensual >= 0),
  is_active        boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index ix_empleados_tienda on empleados (tienda_id, is_active);

create trigger empleados_updated_at before update on empleados
  for each row execute function update_updated_at();

-- ==================== EXPENSE_CATEGORIES ====================

create table expense_categories (
  id          uuid        primary key default gen_random_uuid(),
  tienda_id   uuid        not null references tiendas(id) on delete cascade,
  nombre      text        not null,
  slug        text        not null,
  tipo        text        not null default 'variable' check (tipo in ('fijo', 'variable')),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tienda_id, slug)
);

create trigger expense_categories_updated_at before update on expense_categories
  for each row execute function update_updated_at();

-- ==================== EXPENSES ====================

create table expenses (
  id                uuid          primary key default gen_random_uuid(),
  tienda_id         uuid          not null references tiendas(id) on delete cascade,
  category_id       uuid          not null references expense_categories(id) on delete restrict,
  empleado_id       uuid          references empleados(id) on delete restrict,
  concepto          text          not null,
  notas             text,
  monto             numeric(14,2) not null check (monto > 0),
  fecha_gasto       date          not null default current_date,
  metodo_pago       text          not null check (
    metodo_pago in ('efectivo_caja', 'efectivo_externo', 'transferencia', 'tarjeta')
  ),
  cash_movement_id  uuid          references cash_movements(id),
  -- 'YYYY-MM' o 'YYYY-MM-Q1'/'YYYY-MM-Q2' para nómina y gastos recurrentes
  periodo           text,
  status            text          not null default 'active' check (status in ('active', 'voided')),
  voided_by         uuid          references auth.users(id),
  voided_at         timestamptz,
  voided_reason     text,
  created_by        uuid          not null references auth.users(id),
  created_at        timestamptz   not null default now()
);

create index ix_expenses_tienda_fecha    on expenses (tienda_id, fecha_gasto desc);
create index ix_expenses_tienda_category on expenses (tienda_id, category_id);
create index ix_expenses_tienda_empleado on expenses (tienda_id, empleado_id) where empleado_id is not null;

-- ==================== EXPENSE_TEMPLATES ====================

create table expense_templates (
  id              uuid          primary key default gen_random_uuid(),
  tienda_id       uuid          not null references tiendas(id) on delete cascade,
  category_id     uuid          not null references expense_categories(id) on delete restrict,
  empleado_id     uuid          references empleados(id) on delete cascade,
  concepto        text          not null,
  monto_sugerido  numeric(14,2) not null check (monto_sugerido > 0),
  frecuencia      text          not null default 'mensual' check (frecuencia in ('mensual', 'quincenal')),
  is_active       boolean       not null default true,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index ix_expense_templates_tienda on expense_templates (tienda_id, is_active);

create trigger expense_templates_updated_at before update on expense_templates
  for each row execute function update_updated_at();

-- ==================== RLS (solo admin) ====================

alter table empleados         enable row level security;
alter table expense_categories enable row level security;
alter table expenses          enable row level security;
alter table expense_templates enable row level security;

create policy "admin_only" on public.empleados
  for all to authenticated
  using (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = empleados.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = empleados.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

create policy "admin_only" on public.expense_categories
  for all to authenticated
  using (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = expense_categories.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = expense_categories.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

create policy "admin_only" on public.expenses
  for all to authenticated
  using (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = expenses.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = expenses.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

create policy "admin_only" on public.expense_templates
  for all to authenticated
  using (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = expense_templates.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = expense_templates.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

-- ==================== SEED: categorías por tienda ====================

insert into expense_categories (tienda_id, nombre, slug, tipo)
select t.id, c.nombre, c.slug, c.tipo
from tiendas t
cross join (
  values
    ('Nómina',             'nomina',        'fijo'),
    ('Arriendo',           'arriendo',      'fijo'),
    ('Servicios públicos', 'servicios',     'fijo'),
    ('Mantenimiento',      'mantenimiento', 'variable'),
    ('Insumos',            'insumos',       'variable'),
    ('Marketing',          'marketing',     'variable'),
    ('Transporte',         'transporte',    'variable'),
    ('Otros',              'otros',         'variable')
) as c(nombre, slug, tipo)
on conflict (tienda_id, slug) do nothing;
