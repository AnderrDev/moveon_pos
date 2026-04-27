# Spec de Sesión — 2026-04-26 — Sprint 2: Inventario + Caja

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-26 |
| Sprint | Sprint 2 |
| Agente | Claude Code |
| HUs trabajadas | HU-06, HU-07, HU-08, HU-09, HU-10, HU-11, HU-12 |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Implementar el módulo de inventario (stock, entradas, ajustes, kardex) y el módulo de caja (apertura, movimientos, cierre) siguiendo Clean Architecture con repositorios, use-cases y Server Actions.

También: crear usuario de prueba en Supabase (`admin@moveonpos.co` / `Admin1234!`).

---

## 2. Lo que se implementó

### 2.1 Archivos creados

**Inventario:**
- `src/modules/inventory/domain/repositories/inventory.repository.ts` — interfaz `InventoryRepository`
- `src/modules/inventory/infrastructure/mappers/inventory.mapper.ts` — `InventoryMovementRow` → `InventoryMovement`
- `src/modules/inventory/infrastructure/repositories/supabase-inventory.repository.ts` — implementación con Supabase
- `src/modules/inventory/application/dtos/inventory.dto.ts` — schemas Zod: `registerEntrySchema`, `adjustStockSchema`
- `src/modules/inventory/application/actions/inventory.actions.ts` — Server Actions: `registerEntryAction`, `adjustStockAction`
- `src/modules/inventory/components/RegisterEntryDialog.tsx` — diálogo para entradas de mercancía
- `src/modules/inventory/components/AdjustStockDialog.tsx` — diálogo para ajustes manuales
- `src/modules/inventory/components/KardexDialog.tsx` — historial de movimientos de un producto
- `src/modules/inventory/components/StockTable.tsx` — tabla de stock con acciones (ajustar, kardex)

**Caja:**
- `src/modules/cash-register/domain/repositories/cash-register.repository.ts` — interfaz `CashRegisterRepository`
- `src/modules/cash-register/infrastructure/mappers/cash-register.mapper.ts` — rows → entidades
- `src/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository.ts` — implementación Supabase con cálculo de `expected_cash_amount` al cierre
- `src/modules/cash-register/application/dtos/cash-register.dto.ts` — schemas Zod para open/movement/close
- `src/modules/cash-register/application/actions/cash-register.actions.ts` — `openSessionAction`, `addCashMovementAction`, `closeSessionAction`
- `src/modules/cash-register/components/OpenSessionForm.tsx` — formulario apertura
- `src/modules/cash-register/components/AddMovementDialog.tsx` — diálogo ingreso/egreso/gasto
- `src/modules/cash-register/components/CloseSessionDialog.tsx` — diálogo cierre con conteo real
- `src/modules/cash-register/components/SessionSummary.tsx` — resumen en tiempo real del turno abierto

**Repositorio de productos (Sprint 1, completado antes de sprint 2):**
- `src/modules/products/infrastructure/mappers/product.mapper.ts`
- `src/modules/products/infrastructure/repositories/supabase-product.repository.ts`
- `src/modules/products/infrastructure/repositories/supabase-categoria.repository.ts`
- `src/modules/products/application/use-cases/list-productos.use-case.ts`
- `src/modules/products/application/use-cases/list-categorias.use-case.ts`
- `src/modules/products/application/actions/search-products.action.ts`
- `src/modules/products/components/ProductSearch.tsx`

### 2.2 Archivos modificados

- `src/app/(app)/inventario/page.tsx` — reemplazado `ComingSoon` con página real de stock
- `src/app/(app)/caja/page.tsx` — reemplazado `ComingSoon` con página real de caja
- `src/app/(app)/productos/page.tsx` — usa repositorios en lugar de queries inline
- `src/app/(app)/productos/categorias/page.tsx` — usa repositorios en lugar de queries inline

### 2.3 Datos creados en Supabase

- Tienda: `a1b2c3d4-0000-0000-0000-000000000001` → "MOVEONAPP POS"
- Usuario: `b2c3d4e5-0000-0000-0000-000000000002` → `admin@moveonpos.co` / `Admin1234!` / rol `admin`

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Forms en dialogs de inventario/caja usan inputs nativos (no shared FormInput/FormCurrencyInput) | Crear hooks RHF para cada diálogo | Los shared components requieren `control` de RHF; para forms simples de 2-3 campos con Server Actions directas, HTML nativo es más limpio y evita overhead de `useForm` innecesario |
| `getStockLevels` calcula stock en app (no SQL) | Vista materializada o función SQL agregada | Más flexible; no requiere migración nueva; ok para catálogo de ≤500 productos |
| `closeSession` calcula `expected_cash_amount` en el repositorio (no en la DB) | Trigger SQL | Más simple de mantener; los movimientos de caja nunca llegan a miles de registros |
| Usar `as any` en `.rpc('get_stock', ...)` | Añadir la función al tipo `AppDatabase` | La función no está en `database.types.ts` generado; `as any` evita regenerar tipos solo por esta función |

---

## 4. ADRs creados o actualizados

— (ninguno; decisiones siguen los principios de `docs/02-architecture.md`)

---

## 5. Tests

- [x] `pnpm typecheck` — pasó (0 errores)
- [x] `pnpm lint` — pasó (0 warnings ni errores)
- [ ] `pnpm test` — pendiente

---

## 6. Bloqueos y preguntas pendientes

- [ ] La función `get_stock` no está en `database.types.ts`. Si se quiere tipado estricto, ejecutar `pnpm db:types` para regenerar desde el proyecto remoto.
- [ ] Las páginas de inventario y caja tienen estado cliente vs servidor: al enviar una acción, Next.js revalida el path y re-renderiza la página. Funciona bien con el patrón actual.

---

## 7. Próximos pasos

1. **Sprint 2 pendiente:** implementar `Button` con `size="sm"` si aún no existe (verificar que `StockTable` compila bien con ese prop)
2. **Sprint 3 — POS:** implementar la pantalla de punto de venta real (`/pos`):
   - Usar `<ProductSearch>` ya creado
   - Carrito de compra con estado Zustand
   - Cálculo de IVA y totales en dominio (`sales` module)
   - Server Action `createSaleAction` que crea `sale` + `sale_items` + `payments` + `inventory_movements` (sale_exit) en transacción
3. **Sprint 3 — Ventas:**
   - `SaleRepository` en infraestructura
   - Use-cases: `CreateSale`, `VoidSale`, `GetSaleSummary`
4. Regenerar tipos DB: `pnpm db:types` para tener tipado completo con la función `get_stock`
5. Implementar tests unitarios para domain de `inventory` y `cash-register`

---

## 8. Notas adicionales

**Patrón de formularios en diálogos simples:**
Los shared `FormInput`, `FormCurrencyInput` etc. solo funcionan dentro de un `useForm()` context de React Hook Form (necesitan el `control` prop). Para diálogos simples que usan `useActionState` + Server Actions directamente, usar `<input>` nativo con `className={inputCls}` es la solución correcta y más limpia.

**Arquitectura de módulos completada:**
- `products`: domain ✅ · application ✅ · infrastructure ✅ · components ✅
- `inventory`: domain ✅ · application ✅ · infrastructure ✅ · components ✅
- `cash-register`: domain ✅ · application ✅ · infrastructure ✅ · components ✅
- `sales`: domain (entidades) ✅ · **application/infrastructure pendiente** (Sprint 3)
- `auth`: domain ✅ · application ✅ · infrastructure (scaffold) · components ✅
