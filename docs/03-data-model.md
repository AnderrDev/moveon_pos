# 03 — Modelo de datos

> Este documento es la fuente de verdad del modelo de datos. Toda nueva tabla o columna se documenta aquí antes de crear migration.

---

## Convenciones

- **Nombres en `snake_case`.** Tablas en plural, columnas en singular.
- **Toda tabla tiene `id uuid` como PK** (default `gen_random_uuid()`).
- **Toda tabla operativa tiene `tienda_id uuid not null`** con FK a `tiendas`.
- **Toda tabla operativa tiene `created_at timestamptz` y `updated_at timestamptz`** (default `now()`).
- **Soft delete**: solo donde aplique (ventas anuladas, productos archivados). No usar `deleted_at` genérico.
- **Decimales**: `numeric(14,2)` para dinero. **Nunca `float`** para dinero.
- **Cantidades de inventario**: `numeric(14,3)` para soportar fracciones (ej: 0.250 kg).

---

## Catálogo de tablas (MVP v1.0)

### Multi-sede

#### `tiendas`
```
id              uuid PK
nombre          text not null
nit             text
direccion       text
telefono        text
ciudad          text
is_active       boolean default true
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

#### `user_tiendas`
Relaciona usuarios con tiendas y rol.
```
id              uuid PK
user_id         uuid not null  (FK auth.users)
tienda_id       uuid not null  (FK tiendas)
rol             text not null  CHECK (rol IN ('admin', 'cajero'))
is_active       boolean default true
created_at      timestamptz default now()

UNIQUE (user_id, tienda_id)
```

---

### Productos y catálogo

#### `categorias`
```
id              uuid PK
tienda_id       uuid not null  (FK tiendas)
nombre          text not null
orden           int default 0
is_active       boolean default true
created_at      timestamptz default now()
updated_at      timestamptz default now()

UNIQUE (tienda_id, nombre)
```

#### `productos`
```
id              uuid PK
tienda_id       uuid not null  (FK tiendas)
categoria_id    uuid           (FK categorias, nullable)
nombre          text not null
sku             text
codigo_barras   text
tipo            text not null  CHECK (tipo IN ('simple', 'prepared', 'ingredient'))
unidad          text default 'unidad'
precio_venta    numeric(14,2) not null
costo           numeric(14,2)
iva_tasa        numeric(5,2) not null default 0  -- ej: 19.00, 5.00, 0.00
stock_minimo    numeric(14,3) default 0
is_active       boolean default true
created_at      timestamptz default now()
updated_at      timestamptz default now()

UNIQUE (tienda_id, sku) WHERE sku IS NOT NULL
UNIQUE (tienda_id, codigo_barras) WHERE codigo_barras IS NOT NULL
INDEX (tienda_id, nombre)
INDEX (tienda_id, codigo_barras)
```

> **Nota tipo `prepared`:** representa batidos. En v1.0 se manejan como producto simple con su propio stock o stock infinito. La descomposición en ingredientes (recetas) llega en v1.2.

---

### Inventario

#### `inventory_movements`
Toda variación de stock pasa por aquí. **Nunca** se actualiza `productos.stock` directamente.
```
id              uuid PK
tienda_id       uuid not null  (FK tiendas)
producto_id     uuid not null  (FK productos)
tipo            text not null  CHECK (tipo IN ('entry', 'sale_exit', 'adjustment', 'void_return'))
cantidad        numeric(14,3) not null  -- positiva: entra. negativa: sale.
costo_unitario  numeric(14,2)
motivo          text
referencia_tipo text  -- 'sale', 'adjustment', etc.
referencia_id   uuid  -- id de la venta o ajuste
created_by      uuid not null  (FK auth.users)
created_at      timestamptz default now()

INDEX (tienda_id, producto_id, created_at DESC)
INDEX (referencia_tipo, referencia_id)
```

#### Vista materializada `producto_stock` (o función)
El stock actual se calcula como `SUM(cantidad)` agrupado por producto. En MVP usamos una **función** `get_stock(producto_id, tienda_id)` o una columna calculada en vista. No mantenemos columna `stock` denormalizada para evitar inconsistencias.

> Decisión: si performance se vuelve problema, evaluamos cache o trigger. Ver ADR cuando ocurra.

---

### Clientes

#### `clientes`
```
id                  uuid PK
tienda_id           uuid not null  (FK tiendas)
tipo_documento      text  -- 'CC', 'CE', 'NIT', 'PP', etc.
numero_documento    text
nombre              text not null
email               text
telefono            text
created_at          timestamptz default now()
updated_at          timestamptz default now()

UNIQUE (tienda_id, tipo_documento, numero_documento) WHERE numero_documento IS NOT NULL
INDEX (tienda_id, nombre)
INDEX (tienda_id, telefono)
```

> Fidelización (puntos, niveles) llega en v1.3 con tablas adicionales.

---

### Caja

#### `cash_sessions`
```
id                          uuid PK
tienda_id                   uuid not null  (FK tiendas)
opened_by                   uuid not null  (FK auth.users)
closed_by                   uuid           (FK auth.users)
opening_amount              numeric(14,2) not null
expected_cash_amount        numeric(14,2)  -- calculado al cerrar
actual_cash_amount          numeric(14,2)  -- ingresado por usuario al cerrar
difference                  numeric(14,2)  -- expected - actual
status                      text not null  CHECK (status IN ('open', 'closed'))
notas_cierre                text
opened_at                   timestamptz default now()
closed_at                   timestamptz

INDEX (tienda_id, status)
INDEX (opened_by, status)
```

**Regla:** un usuario solo puede tener una sesión `open` a la vez. Esto se valida con índice parcial:
```sql
CREATE UNIQUE INDEX ux_one_open_session_per_user
  ON cash_sessions (opened_by) WHERE status = 'open';
```

#### `cash_movements`
Ingresos/egresos manuales durante la sesión (no son ventas).
```
id                  uuid PK
cash_session_id     uuid not null  (FK cash_sessions)
tipo                text not null  CHECK (tipo IN ('cash_in', 'cash_out', 'expense', 'correction'))
amount              numeric(14,2) not null
motivo              text not null
created_by          uuid not null  (FK auth.users)
created_at          timestamptz default now()

INDEX (cash_session_id)
```

---

### Ventas

#### `sales`
```
id                  uuid PK
tienda_id           uuid not null  (FK tiendas)
cash_session_id     uuid not null  (FK cash_sessions)
sale_number         text not null   -- correlativo interno por tienda, ej: '000123'
cliente_id          uuid           (FK clientes, nullable)
cashier_id          uuid not null  (FK auth.users)
subtotal            numeric(14,2) not null
discount_total      numeric(14,2) not null default 0
tax_total           numeric(14,2) not null default 0
total               numeric(14,2) not null
status              text not null  CHECK (status IN ('completed', 'voided'))
billing_status      text not null  CHECK (billing_status IN ('not_required', 'pending', 'sent', 'accepted', 'rejected', 'failed'))
billing_document_id uuid           (FK billing_documents, nullable)
voided_by           uuid           (FK auth.users)
voided_at           timestamptz
voided_reason       text
idempotency_key     text not null  UNIQUE
created_at          timestamptz default now()
updated_at          timestamptz default now()

UNIQUE (tienda_id, sale_number)
INDEX (tienda_id, created_at DESC)
INDEX (cash_session_id)
INDEX (cliente_id)
INDEX (billing_status) WHERE billing_status IN ('pending', 'failed')
```

#### `sale_items`
```
id                  uuid PK
sale_id             uuid not null  (FK sales ON DELETE RESTRICT)
producto_id         uuid not null  (FK productos)
producto_nombre     text not null  -- snapshot
producto_sku        text           -- snapshot
quantity            numeric(14,3) not null
unit_price          numeric(14,2) not null  -- precio unitario en venta
discount_amount     numeric(14,2) not null default 0
tax_rate            numeric(5,2) not null default 0
tax_amount          numeric(14,2) not null default 0
total               numeric(14,2) not null

INDEX (sale_id)
INDEX (producto_id, sale_id)
```

> Snapshot de nombre/SKU evita problemas si el producto se renombra después.

#### `payments`
```
id                  uuid PK
sale_id             uuid not null  (FK sales)
metodo              text not null  CHECK (metodo IN ('cash', 'card', 'nequi', 'daviplata', 'transfer', 'other'))
amount              numeric(14,2) not null
referencia          text  -- últimos 4 dígitos tarjeta, número aprobación, etc.
created_at          timestamptz default now()

INDEX (sale_id)
```

> Una venta puede tener N `payments` (pagos mixtos).

---

### Facturación electrónica

> **Nota:** este módulo se implementa funcionalmente en **v1.1**, pero las tablas se crean desde v1.0 para que `sales` pueda referenciarlas correctamente.

#### `billing_documents`
```
id                  uuid PK
tienda_id           uuid not null  (FK tiendas)
sale_id             uuid not null  (FK sales) UNIQUE
provider            text not null   -- 'factus', 'alegra', 'mock', etc.
document_type       text not null  CHECK (document_type IN ('invoice', 'pos_document', 'credit_note'))
document_number     text           -- ej: 'FE-1234'
prefix              text
cufe_or_cude        text
qr_url              text
pdf_url             text
xml_url             text
status              text not null  CHECK (status IN ('pending', 'sent', 'accepted', 'rejected', 'cancelled', 'failed'))
provider_response   jsonb  -- respuesta cruda del proveedor
last_error          text
attempts            int default 0
issued_at           timestamptz
created_at          timestamptz default now()
updated_at          timestamptz default now()

INDEX (tienda_id, status)
INDEX (sale_id)
```

#### `billing_events`
Auditoría de cada intento.
```
id                      uuid PK
billing_document_id     uuid not null  (FK billing_documents)
event_type              text not null  -- 'attempt', 'response', 'error'
provider_request        jsonb
provider_response       jsonb
error_message           text
created_at              timestamptz default now()

INDEX (billing_document_id, created_at DESC)
```

---

### Auditoría

#### `audit_logs`
Para acciones sensibles (cambio de precio, ajuste manual, anulación de venta, descuento sobre cierto umbral).
```
id              uuid PK
tienda_id       uuid           (FK tiendas, nullable para acciones globales)
user_id         uuid           (FK auth.users, nullable)
action          text not null  -- 'product.price_changed', 'sale.voided', etc.
entity_type     text
entity_id       uuid
metadata        jsonb
created_at      timestamptz default now()

INDEX (tienda_id, created_at DESC)
INDEX (entity_type, entity_id)
```

---

### Configuración

#### `settings`
Configuración por tienda.
```
id              uuid PK
tienda_id       uuid not null  (FK tiendas) UNIQUE
data            jsonb not null  default '{}'::jsonb
updated_at      timestamptz default now()
```

Estructura sugerida del JSONB:
```json
{
  "ticket": {
    "header_text": "MOVEONAPP",
    "footer_text": "Gracias por su compra",
    "show_iva_breakdown": true
  },
  "billing": {
    "provider": "mock",
    "default_document_type": "pos_document",
    "auto_issue_on_request": true
  },
  "ui": {
    "default_payment_method": "cash"
  }
}
```

---

## Diagrama relacional simplificado

```
auth.users ──< user_tiendas >── tiendas ──┬── categorias
                                          ├── productos ──< inventory_movements
                                          ├── clientes
                                          ├── cash_sessions ──< cash_movements
                                          │                  ──< sales ──< sale_items
                                          │                              ──< payments
                                          │                              ──> billing_documents ──< billing_events
                                          ├── settings
                                          └── audit_logs
```

---

## Migrations

Una migration por cambio. Nombres:
```
supabase/migrations/
  20260425_000_initial_schema.sql
  20260425_001_rls_policies.sql
  20260425_002_seed_dev_data.sql
```

---

## Reglas de RLS

Todas las tablas operativas (`productos`, `clientes`, `sales`, etc.) llevan política base:
```sql
CREATE POLICY "tenant_isolation" ON <tabla>
  FOR ALL USING (
    tienda_id IN (
      SELECT tienda_id FROM user_tiendas
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

Políticas adicionales por tabla y rol se documentan en `/docs/modules/<modulo>.md`.
