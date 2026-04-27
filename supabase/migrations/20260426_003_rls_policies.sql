-- ============================================================
-- MIGRACIÓN 4 — MOVEONAPP POS
-- RLS: habilitar y crear políticas de aislamiento por tienda
-- en todas las tablas operativas.
-- ============================================================

-- ==================== ENABLE RLS ====================

alter table categorias          enable row level security;
alter table productos           enable row level security;
alter table inventory_movements enable row level security;
alter table clientes            enable row level security;
alter table cash_sessions       enable row level security;
alter table cash_movements      enable row level security;
alter table billing_documents   enable row level security;
alter table sales               enable row level security;
alter table sale_items          enable row level security;
alter table payments            enable row level security;
alter table billing_events      enable row level security;
alter table settings            enable row level security;

-- ==================== POLÍTICAS (tenant isolation) ====================
-- Patrón base: el usuario solo accede a datos de su(s) tienda(s).
-- get_user_tiendas() retorna los tienda_id del usuario autenticado.

-- categorias
create policy "tenant_isolation" on categorias for all
  using (tienda_id in (select get_user_tiendas()));

-- productos
create policy "tenant_isolation" on productos for all
  using (tienda_id in (select get_user_tiendas()));

-- inventory_movements
create policy "tenant_isolation" on inventory_movements for all
  using (tienda_id in (select get_user_tiendas()));

-- clientes
create policy "tenant_isolation" on clientes for all
  using (tienda_id in (select get_user_tiendas()));

-- cash_sessions
create policy "tenant_isolation" on cash_sessions for all
  using (tienda_id in (select get_user_tiendas()));

-- cash_movements (sin tienda_id directo → join a cash_sessions)
create policy "tenant_isolation" on cash_movements for all
  using (
    cash_session_id in (
      select id from cash_sessions
      where tienda_id in (select get_user_tiendas())
    )
  );

-- billing_documents
create policy "tenant_isolation" on billing_documents for all
  using (tienda_id in (select get_user_tiendas()));

-- sales
create policy "tenant_isolation" on sales for all
  using (tienda_id in (select get_user_tiendas()));

-- sale_items (sin tienda_id directo → join a sales)
create policy "tenant_isolation" on sale_items for all
  using (
    sale_id in (
      select id from sales
      where tienda_id in (select get_user_tiendas())
    )
  );

-- payments (sin tienda_id directo → join a sales)
create policy "tenant_isolation" on payments for all
  using (
    sale_id in (
      select id from sales
      where tienda_id in (select get_user_tiendas())
    )
  );

-- billing_events (sin tienda_id directo → join a billing_documents)
create policy "tenant_isolation" on billing_events for all
  using (
    billing_document_id in (
      select id from billing_documents
      where tienda_id in (select get_user_tiendas())
    )
  );

-- settings
create policy "tenant_isolation" on settings for all
  using (tienda_id in (select get_user_tiendas()));
