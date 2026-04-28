# Spec de Sesión — 2026-04-27 — Auditoría y correcciones

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-27 |
| Sprint | Post Sprint 4 — calidad |
| Agente | Claude Code |
| HUs trabajadas | N/A — auditoría transversal |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Ejecutar auditoría completa del proyecto usando los frameworks de las skills disponibles (`frontend-design`, `ui-ux-pro-max`) y corregir todos los hallazgos priorizados antes de iniciar Sprint 5.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260427_001_create_sale_atomic.sql` — función PL/pgSQL `create_sale_atomic()` con transacción real (4 inserts en un solo BEGIN/COMMIT implícito)

### 2.2 Archivos modificados

- `src/modules/customers/application/actions/cliente.actions.ts` — `deleteClienteAction` ahora exige `rol === 'admin'`
- `src/app/(app)/layout.tsx` — skip link accesible + `id="main-content"` en `<main>`
- `src/app/globals.css` — bloque `prefers-reduced-motion` global
- `src/shared/components/ui/Button.tsx` — `icon-sm` sube de h-7 w-7 a h-9 w-9
- `src/modules/sales/components/CartPanel.tsx` — botón eliminar ítem h-7→h-9
- `src/modules/sales/components/SalesHistory.tsx` — botones refresh y anular h-9 w-9
- `src/shared/components/feedback/ToastProvider.tsx` — botón cerrar toast h-8 w-8
- `src/modules/sales/components/ProductGrid.tsx` — botón limpiar búsqueda h-8 w-8
- `src/modules/products/components/CategoriaActions.tsx` — `aria-label` en botones icono
- `src/modules/products/components/ProductoActions.tsx` — `aria-label` en botones icono
- `src/modules/cash-register/components/AddMovementDialog.tsx` — `htmlFor`+`id` en inputs, `inputMode="numeric"`
- `src/modules/cash-register/components/CloseSessionDialog.tsx` — `htmlFor`+`id` en inputs, `inputMode="numeric"`
- `src/modules/cash-register/components/SessionSummary.tsx` — marcado como Client Component para permitir el botón interactivo de impresión en `/caja`
- `src/modules/sales/components/SaleSuccessModal.tsx` — removida variable sin uso que bloqueaba `pnpm lint`
- Base Supabase remota — aplicada función `public.create_sale_atomic(...)` desde `supabase/migrations/20260427_001_create_sale_atomic.sql` y recargado schema cache de PostgREST con `notify pgrst, 'reload schema'`

---

## 3. Decisiones tomadas

| Decisión | Alternativa | Razón |
|---|---|---|
| `icon-sm` → h-9 w-9 (36px) en lugar de h-11 (44px) | h-11 w-11 full WCAG | Pantalla de escritorio/tablet; 36px es aceptable para POS interno. Botones contextuales de tabla no deben dominar visualmente. |
| `prefers-reduced-motion` global en CSS | Por componente con `motion-safe:` | Una sola regla global cubre todas las animaciones existentes y futuras sin requerir anotación por clase. |
| Skip link con `sr-only focus:not-sr-only` | Visible siempre | Estándar moderno: invisible en uso normal, visible al tabular — no interfiere con el diseño. |

---

## 5. Tests

- [x] `npx tsc --noEmit` — 0 errores
- [x] `npx vitest run` — 84 tests pasaron, 0 fallaron
- [x] `corepack pnpm typecheck` — 0 errores
- [x] `corepack pnpm lint` — 0 errores
- [x] `corepack pnpm test` — 84 tests pasaron, 0 fallaron
- [x] Verificación SQL remota — `public.create_sale_atomic(...)` existe con la firma esperada por el repositorio

---

## 6. Bloqueos y preguntas pendientes

- ~~Transacción atómica en `createSale`~~ — **resuelto**: función `create_sale_atomic()` + repositorio actualizado.
- [ ] **Dark mode toggle** — tokens definidos, sin UI para activarlo.

---

## 7. Próximos pasos

1. Crear función PL/pgSQL `create_sale_atomic()` con transacción real
2. Sprint 5: importación CSV desde Siigo
3. Dark mode toggle en sidebar (opcional, bajo prioridad)

---

## 8. Notas adicionales

La auditoría se realizó usando los scripts de `ui-ux-pro-max` y revisión manual contra los frameworks de `frontend-design`. El diseño del sistema de color (naranja primario, sidebar oscura) fue validado por la skill como adecuado para POS retail. La recomendación de fuentes Rubik/Nunito Sans es una mejora de calidad, no bloqueante para MVP.

### Revisión de lógica de negocio pendiente

Se revisó la implementación contra `/docs/01-mvp-scope.md`, `/docs/03-data-model.md`, `/docs/modules/sales.md` y `/docs/modules/cash-register.md`. Hallazgos principales:
- Cierre de caja no incluye pagos en efectivo de ventas.
- `difference` de caja está calculado como `actual - expected`, pero la documentación define `expected - actual`.
- Creación de venta confía en totales, descuentos, nombres y precios enviados desde cliente.
- Validación de pagos insuficiente en servidor: no recalcula suma de pagos contra total ni restringe cambio a efectivo.
- Anulación de venta no es atómica y no valida error al insertar `void_return`.
- RLS es demasiado amplia para acciones sensibles porque usa `for all` por tienda sin separar permisos por rol.

### Correcciones de lógica aplicadas

- Caja: el esperado ahora suma apertura + ventas en efectivo + ingresos manuales − egresos/gastos.
- Caja: `difference` quedó alineado con docs como `expected - actual`; descuadres mayores a $5.000 requieren nota de cierre.
- Ventas: el servidor recarga producto activo desde DB y recalcula nombre, SKU, precio, IVA, subtotal, descuentos, impuestos y total.
- Ventas: se valida que pagos cubran el total y que el cambio solo pueda salir de efectivo.
- Ventas: cajero queda limitado a descuento máximo de 10%; admin puede superar el umbral.
- Inventario: la venta valida stock agregado por producto; productos `prepared` no descuentan stock en MVP.
- SQL: `create_sale_atomic()` valida caja abierta, pagos, producto activo y stock dentro de la transacción con advisory lock por producto.
- SQL: `void_sale_atomic()` anula venta, repone inventario y audita en una sola transacción.
- Permisos: Server Actions de productos e inventario ahora exigen rol admin.
- Tests: `sale-calculator.test.ts` cubre validación de pagos y umbral de descuento.
- Base remota: aplicada `supabase/migrations/20260427_002_harden_sales_cash_logic.sql` y recargado schema cache de PostgREST.

### Conciliación simple de pagos digitales

- Decisión operativa: no se agregan estados, referencias ni fotos al sistema para pagos digitales en MVP.
- La venta con transferencia/Nequi/Daviplata/tarjeta se confirma solo después de validación manual externa.
- La trazabilidad se hace por hora exacta, valor y método de pago.
- `/caja` ahora muestra "Otros medios confirmados" separado del efectivo físico del turno.
- `/reportes` ahora separa "Efectivo en caja" de "Otros medios confirmados" y el detalle de ventas muestra hora con segundos y valor por método.
- Validación posterior: `corepack pnpm typecheck`, `corepack pnpm lint` y `corepack pnpm test` pasan con 91 tests.

### Auditoría de estándares y cobertura

- `corepack pnpm typecheck` pasa.
- `corepack pnpm lint` pasa sin warnings ni errores.
- `corepack pnpm test` pasa con 12 archivos y 91 tests.
- `corepack pnpm test:coverage` pasa umbral configurado: statements 99.78%, branches 95.74%, functions 100%, lines 99.78%.
- Nota importante: la cobertura configurada solo incluye DTOs, domain services, forms, store, shared forms/result/validations; no mide Server Actions, repositories, componentes React, app routes, RLS/migrations ni flujos integración/E2E.
- Brechas contra estándares: varias Server Actions importan infraestructura o hacen SQL directo; faltan use-cases en la mayoría de módulos; hay duplicación de `formatCOP`/labels de métodos de pago; `as any` sigue documentado como workaround de Supabase; tests de integración/E2E siguen vacíos.

### Refactor de estándares aplicado

- Se centralizaron helpers compartidos en `src/shared/lib/format.ts` para moneda, hora y fecha corta.
- Se centralizaron labels y opciones de medios de pago en `src/shared/lib/payment-methods.ts`.
- Componentes de POS, caja, reportes, productos e inventario ahora reutilizan los helpers compartidos en vez de duplicar `Intl`/labels.
- Se extrajo `createSaleUseCase` para mover la lógica de creación de venta fuera de la Server Action y dejar dependencias inyectadas por interfaces.
- `sale.actions.ts` quedó como capa de validación/autorización y wiring de repositorios, no como dueña de reglas de negocio.
- `vitest.config.ts` ahora incluye `application/use-cases`, `format.ts` y `payment-methods.ts` en la medición de cobertura.
- Tests agregados:
  - `tests/unit/modules/sales/create-sale-use-case.test.ts`
  - `tests/unit/modules/products/product-use-cases.test.ts`
  - `tests/unit/shared/lib/format.test.ts`
  - `tests/unit/shared/lib/payment-methods.test.ts`
- Validación final:
  - `corepack pnpm typecheck` pasa.
  - `corepack pnpm lint` pasa sin warnings ni errores.
  - `corepack pnpm test` pasa con 16 archivos y 109 tests.
  - `corepack pnpm test:coverage` pasa: statements 99.83%, branches 92.73%, functions 100%, lines 99.83%.

### Mejora de cierre total de caja

- Decisión: el cierre de caja ahora controla el total de ventas del turno por todos los medios de pago, no solo efectivo.
- Se mantiene el arqueo de efectivo físico como control separado: apertura + ventas cash + movimientos contra efectivo contado.
- Se agregaron columnas en `cash_sessions` para cierre total:
  - `expected_sales_amount`
  - `actual_sales_amount`
  - `sales_difference`
  - `payment_closure`
- Se creó la migración `supabase/migrations/20260428_001_add_total_sales_closure.sql`.
- Base remota: aplicada `20260428_001_add_total_sales_closure.sql` y recargado schema cache de PostgREST.
- `CloseSessionDialog` ahora muestra ventas esperadas, ventas confirmadas, diferencia total y diferencia de efectivo físico.
- El cierre solicita confirmación por medios no efectivo: tarjeta, Nequi, Daviplata, transferencia y otros.
- `/caja` ahora lista últimas sesiones con ventas esperadas, confirmado, diferencia de ventas y diferencia de efectivo.
- `/reportes` ahora prioriza total vendido, efectivo de ventas, otros medios, distribución porcentual por método y estado de cierres.
- Documentación actualizada en `docs/01-mvp-scope.md`, `docs/modules/cash-register.md` y `docs/modules/reports.md`.
- Validación posterior:
  - `corepack pnpm typecheck` pasa.
  - `corepack pnpm lint` pasa sin warnings ni errores.
  - `corepack pnpm test` pasa con 16 archivos y 112 tests.
  - `corepack pnpm test:coverage` pasa: statements 99.83%, branches 92.73%, functions 100%, lines 99.83%.
