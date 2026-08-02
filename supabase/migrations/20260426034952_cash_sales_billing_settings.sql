-- ============================================================
-- MIGRACIÓN 3 — MOVEONAPP POS
-- Módulos: caja (cash_sessions, cash_movements),
--          ventas (billing_documents*, sales, sale_items, payments),
--          facturación (billing_events),
--          configuración (settings)
--
-- * billing_documents se crea antes que sales para resolver
--   la referencia circular; la FK sale_id se agrega al final.
-- ============================================================

-- ==================== CASH_SESSIONS ====================

create table cash_sessions (
  id                    uuid                primary key default gen_random_uuid(),
  tienda_id             uuid                not null references tiendas(id) on delete cascade,
  opened_by             uuid                not null references auth.users(id),
  closed_by             uuid                references auth.users(id),
  opening_amount        numeric(14,2)       not null,
  expected_cash_amount  numeric(14,2),
  actual_cash_amount    numeric(14,2),
  difference            numeric(14,2),
  status                cash_session_status not null default 'open',
  notas_cierre          text,
  opened_at             timestamptz         not null default now(),
  closed_at             timestamptz
);

create index        ix_cash_sessions_tienda_status on cash_sessions (tienda_id, status);
create index        ix_cash_sessions_user_status   on cash_sessions (opened_by, status);
-- Un usuario solo puede tener una sesión abierta a la vez
create unique index ux_one_open_session_per_user   on cash_sessions (opened_by) where status = 'open';

-- ==================== CASH_MOVEMENTS ====================

create table cash_movements (
  id              uuid               primary key default gen_random_uuid(),
  cash_session_id uuid               not null references cash_sessions(id) on delete cascade,
  tipo            cash_movement_type not null,
  amount          numeric(14,2)      not null,
  motivo          text               not null,
  created_by      uuid               not null references auth.users(id),
  created_at      timestamptz        not null default now()
);

create index ix_cash_movements_session on cash_movements (cash_session_id);

-- ==================== BILLING_DOCUMENTS ====================
-- sale_id se agrega como nullable aquí; la FK a sales se añade
-- después de crear esa tabla para romper la referencia circular.

create table billing_documents (
  id                uuid               primary key default gen_random_uuid(),
  tienda_id         uuid               not null references tiendas(id) on delete cascade,
  sale_id           uuid               unique,
  provider          text               not null,
  document_type     billing_doc_type   not null default 'pos_document',
  document_number   text,
  prefix            text,
  cufe_or_cude      text,
  qr_url            text,
  pdf_url           text,
  xml_url           text,
  status            billing_doc_status not null default 'pending',
  provider_response jsonb,
  last_error        text,
  attempts          int                not null default 0,
  issued_at         timestamptz,
  created_at        timestamptz        not null default now(),
  updated_at        timestamptz        not null default now()
);

create index ix_billing_docs_tienda_status on billing_documents (tienda_id, status);
create index ix_billing_docs_sale          on billing_documents (sale_id);

create trigger billing_documents_updated_at before update on billing_documents
  for each row execute function update_updated_at();

-- ==================== SALES ====================

create table sales (
  id                  uuid            primary key default gen_random_uuid(),
  tienda_id           uuid            not null references tiendas(id) on delete cascade,
  cash_session_id     uuid            not null references cash_sessions(id) on delete restrict,
  sale_number         text            not null,
  cliente_id          uuid            references clientes(id) on delete set null,
  cashier_id          uuid            not null references auth.users(id),
  subtotal            numeric(14,2)   not null,
  discount_total      numeric(14,2)   not null default 0,
  tax_total           numeric(14,2)   not null default 0,
  total               numeric(14,2)   not null,
  status              sale_status     not null default 'completed',
  billing_status      billing_status  not null default 'not_required',
  billing_document_id uuid            references billing_documents(id) on delete set null,
  voided_by           uuid            references auth.users(id),
  voided_at           timestamptz,
  voided_reason       text,
  idempotency_key     text            not null unique,
  created_at          timestamptz     not null default now(),
  updated_at          timestamptz     not null default now(),
  unique (tienda_id, sale_number)
);

create index ix_sales_tienda_created  on sales (tienda_id, created_at desc);
create index ix_sales_cash_session    on sales (cash_session_id);
create index ix_sales_cliente         on sales (cliente_id);
create index ix_sales_billing_pending on sales (billing_status)
  where billing_status in ('pending', 'failed');

create trigger sales_updated_at before update on sales
  for each row execute function update_updated_at();

-- Cierra la referencia circular: billing_documents.sale_id → sales
alter table billing_documents
  add constraint fk_billing_documents_sale
  foreign key (sale_id) references sales(id) on delete restrict;

-- ==================== SALE_ITEMS ====================

create table sale_items (
  id              uuid          primary key default gen_random_uuid(),
  sale_id         uuid          not null references sales(id) on delete restrict,
  producto_id     uuid          not null references productos(id) on delete restrict,
  producto_nombre text          not null,
  producto_sku    text,
  quantity        numeric(14,3) not null,
  unit_price      numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  tax_rate        numeric(5,2)  not null default 0,
  tax_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) not null
);

create index ix_sale_items_sale     on sale_items (sale_id);
create index ix_sale_items_producto on sale_items (producto_id, sale_id);

-- ==================== PAYMENTS ====================

create table payments (
  id          uuid           primary key default gen_random_uuid(),
  sale_id     uuid           not null references sales(id) on delete restrict,
  metodo      payment_method not null,
  amount      numeric(14,2)  not null,
  referencia  text,
  created_at  timestamptz    not null default now()
);

create index ix_payments_sale on payments (sale_id);

-- ==================== BILLING_EVENTS ====================

create table billing_events (
  id                  uuid        primary key default gen_random_uuid(),
  billing_document_id uuid        not null references billing_documents(id) on delete cascade,
  event_type          text        not null,
  provider_request    jsonb,
  provider_response   jsonb,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index ix_billing_events_doc on billing_events (billing_document_id, created_at desc);

-- ==================== SETTINGS ====================

create table settings (
  id          uuid        primary key default gen_random_uuid(),
  tienda_id   uuid        not null references tiendas(id) on delete cascade unique,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create trigger settings_updated_at before update on settings
  for each row execute function update_updated_at();
