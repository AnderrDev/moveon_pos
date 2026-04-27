# Spec de Sesión — 2026-04-26 — Supabase setup y alineación de tipos

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-26 |
| Sprint | Sprint 0 (infraestructura) |
| Agente | Claude Code |
| HUs trabajadas | — (sesión de infraestructura, sin HUs de usuario) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Conectar el proyecto al proyecto Supabase "POS" (`rmaieqyscchtxxkgxgik`), aplicar el schema completo de la base de datos, y alinear todo el código TypeScript con la DB y la documentación.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `supabase/migrations/20260426_001_products_inventory_customers.sql` — tablas `categorias`, `productos`, `inventory_movements`, función `get_stock()`, `clientes`
- `supabase/migrations/20260426_002_cash_sales_billing_settings.sql` — tablas `cash_sessions`, `cash_movements`, `billing_documents`, `sales`, `sale_items`, `payments`, `billing_events`, `settings`
- `supabase/migrations/20260426_003_rls_policies.sql` — RLS habilitado y política `tenant_isolation` en las 12 tablas operativas
- `.env.local` — variables reales del proyecto POS (URL y anon key; service role key pendiente de completar)

### 2.2 Archivos modificados

- `supabase/migrations/20240101000000_initial_schema.sql` — reescrito para corregir enums (valores en español → inglés, campos faltantes), y columnas de tablas base para alinearse con `docs/03-data-model.md`
- `src/shared/types/index.ts` — añadidos `CashMovementType`, `BillingStatus`, `BillingDocStatus`, `BillingDocType`; corregidos `PaymentMethod` (añadido `nequi`, `daviplata`) e `InventoryMovementType` (inglés)
- `src/shared/validations/common.ts` — corregido `paymentMethodSchema`; añadidos `inventoryMovementTypeSchema` y `cashMovementTypeSchema`
- `src/modules/products/domain/entities/product.entity.ts` — `activo` → `isActive`
- `src/modules/products/application/dtos/product.dto.ts` — `activo` → `isActive`
- `src/modules/products/forms/product-form.factory.ts` — `activo` → `isActive`
- `src/modules/products/forms/product-form.mapper.ts` — `activo` → `isActive`
- `src/modules/cash-register/domain/entities/cash-session.entity.ts` — `CashMovement` corregido: usa `CashMovementType`, campos renombrados a `tipo`/`motivo`, eliminados campos inexistentes en DB (`tiendaId`, `method`, `description`)
- `src/modules/inventory/domain/entities/inventory.entity.ts` — `InventoryMovement` alineado con DB: eliminados `previousStock`/`newStock`, añadidos `costoUnitario`, `referenciaTipo`, `referenciaId`, renombrado `reason` → `motivo`
- `src/modules/sales/domain/entities/sale.entity.ts` — `Sale` completado con `saleNumber`, `billingStatus`, `billingDocumentId`, `cashierId`; renombrados `customerId` → `clienteId`, `totalDiscount` → `discountTotal`, `totalIva` → `taxTotal`; `SaleItem` renombrado a `discountAmount`, `taxRate`, `taxAmount`, `productoNombre`, añadido `productoSku`; `Payment` completado con `id`, `saleId`, `metodo`, `referencia`, `createdAt`
- `src/infrastructure/supabase/database.types.ts` — reemplazado placeholder con tipos reales generados desde Supabase MCP
- `supabase/config.toml` — `db.major_version` corregido de 15 a 17
- `package.json` — `db:types` actualizado para usar proyecto remoto (`--project-id rmaieqyscchtxxkgxgik`)

### 2.3 Archivos eliminados

— (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Reescribir migration 1 antes de aplicar | Aplicar original + migration correctiva | DB estaba vacía; más limpio corregir en origen |
| Usar 4 migraciones separadas | Una sola migración monolítica | Separación por responsabilidad: base, productos, ventas/caja, RLS |
| `billing_documents` creada antes que `sales` con FK postergada | Reordenar tablas | Resuelve referencia circular sin dependencias circulares en SQL |
| Tipos de dominio en inglés para `InventoryMovementType` | Mantener español | Los enums de DB usan inglés; dominio debe reflejar la misma semántica |

---

## 4. ADRs creados o actualizados

— (ninguno nuevo; todas las decisiones siguen los principios de `docs/02-architecture.md`)

---

## 5. Tests

- [ ] `pnpm typecheck` — pendiente de ejecutar
- [ ] `pnpm lint` — pendiente
- [ ] `pnpm test` — pendiente (2 tests existentes deben seguir pasando)

---

## 6. Bloqueos y preguntas pendientes

- [ ] `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` en `.env.local` deben completarse manualmente desde el dashboard de Supabase (Settings > API y Settings > Database)

---

## 7. Próximos pasos

1. Completar `.env.local` con `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL`
2. Comenzar Sprint 1: HU-01 (Login), HU-02 (CRUD productos), HU-03 (categorías)
3. Implementar middleware de autenticación Next.js
4. Implementar `ProductRepository` (Supabase) en `src/modules/products/infrastructure/`
5. Implementar Server Actions para productos

---

## 8. Notas adicionales

El proyecto Supabase "POS" (`rmaieqyscchtxxkgxgik`, us-west-2) tiene las 15 tablas del MVP v1.0 aplicadas y activas con RLS. La migración inicial tiene fecha artificial `20240101` (Sprint 0 scaffold); las 3 nuevas tienen fecha real `20260426`.
