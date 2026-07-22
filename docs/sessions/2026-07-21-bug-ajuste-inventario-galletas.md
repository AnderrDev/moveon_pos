# Spec de Sesión — 2026-07-21 — Bug: ajuste de inventario de galletas no se refleja en el stock

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-21 |
| Sprint | Mantenimiento (main) |
| Agente | Claude Code |
| HUs trabajadas | Bug fix (sin HU) |
| Estado | Completada (falta desplegar frontend y commit) |

---

## 1. Objetivo de la sesión

El dueño hizo ajustes de inventario para restar galletas; la UI reportó éxito pero el stock total no cambiaba. Diagnosticar y corregir en producción (Supabase `rmaieqyscchtxxkgxgik`), trabajando sobre `main`.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260721_001_get_stock_levels.sql` — RPC `get_stock_levels(p_tienda_id)` que agrega stock por producto/ubicación en el servidor. **Aplicada a prod.**
- `supabase/migrations/20260721_002_security_perf_hardening.sql` — hardening post-auditoría: search_path fijo, revoke de trigger functions vía REST, índice duplicado, policy redundante en audit_logs, RLS initplan `(select auth.uid())` en product_components + loyalty (guardado con to_regclass porque esas tablas solo tienen migración en dev), listado del bucket product-images restringido a admin. **Aplicada a prod.**
- `supabase/migrations/20260721_003_monthly_totals_rpcs.sql` — RPCs `get_monthly_sales_totals` (tz-aware, default America/Bogota) y `get_monthly_expense_totals` + grants (incluye grants retroactivos de get_stock_levels). **Aplicada a prod.**
- `apps/pos-angular/src/app/core/supabase/fetch-all-pages.ts` — helper `fetchAllPages` que recorre `.range()` en páginas de 1000 para consultas sin cota.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/inventory/inventory.repository.ts` — `getStockLevels()` ahora llama al RPC en vez de descargar todos los `inventory_movements` y sumarlos en el cliente.
- `apps/pos-angular/src/app/features/sales/sales.repository.ts` — `listByDate` y `listBySession` paginados con `fetchAllPages` (reportes/Finanzas/export ya no truncan en 1000 ventas).
- `apps/pos-angular/src/app/features/cash-register/cash-register.repository.ts` — `getPaymentBreakdown`, `listSessionsByDateRange` y `listMovements` paginados.
- `apps/pos-angular/src/app/features/customers/customers.repository.ts` — `list()` paginado (picker del POS ya no pierde clientes al pasar de 1000).
- `apps/pos-angular/src/app/features/expenses/expenses.repository.ts` — `listExpenses` paginado; `listSalesTotalsSince` reemplazado por `getMonthlySalesTotals`/`getMonthlyExpenseTotals` (RPCs).
- `apps/pos-angular/src/app/features/expenses/finanzas.page.ts` — `loadComparison` usa los RPCs de agregación mensual.
- `src/modules/expenses/domain/services/monthly-comparison.ts` (+ test) — `buildMonthlyComparison` recibe totales mensuales pre-agregados en vez de filas crudas.
- `apps/pos-angular/src/app/features/products/products.repository.ts` — término de búsqueda sanitizado antes de interpolarse en `.or()` de PostgREST.

---

## 3. Diagnóstico (causa raíz)

- Los ajustes **sí se insertaban** en `inventory_movements` (por eso la UI decía "exitoso").
- `getStockLevels()` descargaba todos los movimientos de la tienda y sumaba en el navegador.
- PostgREST (Supabase) limita cada consulta a **1000 filas**; la tabla llegó hoy a 1009 movimientos. Los movimientos fuera de las 1000 filas (los más recientes) no entraban en la suma → el total mostrado no cambiaba.
- El bug apareció justo hoy porque hoy se cruzó el umbral de 1000 filas.

### Efecto colateral por reintentos del dueño (2026-07-21)
Como la UI no reflejaba el cambio, se reintentaron ajustes que sí quedaron registrados:
- GALLETA OREO: +1, +1, −3, −3 (neto −4). Stock real resultante: **4** en punto_venta.
- GALLETA NUTELLA: −1 (Perdida). Stock real: **2**.
- HANGRY BOY GALLETA: −1 (Conteo). Stock real: **3**.

**Corrección aplicada (2026-07-22 04:28 UTC):** a pedido del dueño se revirtieron los dos −3 de la Oreo con un movimiento compensatorio de **+6** (`adjustment`, motivo documenta la reversa; no se borraron filas para conservar el kardex). Stock Oreo resultante: **10** en punto_venta. Los dos +1 de ese día se conservaron por decisión del dueño.

---

## 4. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| RPC SQL `get_stock_levels` (STABLE, invoker rights, RLS aplica) | Paginar con `.range()` en el cliente | Mismo patrón que `get_stock` existente; menos datos al navegador; sin límite de filas |

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó
- [x] `pnpm test` — 446 tests pasaron (52 archivos)

---

## 6. Bloqueos y preguntas pendientes

- Ninguno.

---

## 7. Próximos pasos

1. **PENDIENTE CRÍTICO (dueño): rotar la service_role key** del proyecto `rmaieqyscchtxxkgxgik` (filtrada en historial de git, sigue vigente) + actualizar `.env.local` y secrets de `qz-sign`. Decidió posponerla en esta sesión.
2. **Dueño (dashboard):** activar Leaked Password Protection en Auth → Settings.
3. **Desplegar el frontend** — las migraciones ya están en prod pero la app desplegada sigue con el código viejo.
4. Dueño: verificar conteo físico de las 3 galletas vs stock en DB (ver §3) y ajustar desde la UI si hace falta.
5. Al mergear `dev` ↔ `main`, cuidar que las migraciones `20260721_00[123]` queden en ambas ramas (en dev existen migraciones 20260716* de loyalty que no están en main).
6. Advisors aceptados sin acción: vista `storefront_productos_publicos` SECURITY DEFINER (deliberada, solo columnas seguras); RPCs SECURITY DEFINER ejecutables por authenticated (validan rol internamente).

---

## 8. Auditoría de seguridad y escalabilidad (post-bug)

Tras el bug se auditó repo + proyecto Supabase (advisors, RLS, funciones, y dos agentes: consultas sin cota y seguridad).

### CRÍTICO — Seguridad
- **C-1. Service role key vigente filtrada en el historial de git** (`scripts/seed-admin-user.mjs` en commits `673398e`…`c0e16df`, pusheados a GitHub). El fix `86cac38` la quitó del working tree pero no del historial; la key es la misma que hoy está en `.env.local` (role=service_role, exp ~2036). **Acción: rotar la key en el dashboard de Supabase YA**, actualizar `.env.local`/secrets de Edge Functions, revisar logs desde 2026-05-28. Opcional: limpiar historial con git filter-repo.

### ALTA — Escalabilidad (mismo patrón del bug de hoy: suma en cliente + tope 1000 filas de PostgREST)
- **A-1.** `expenses.repository.ts:173` `listSalesTotalsSince()` — trae 6 meses de `sales` sin límite y suma en cliente para la comparativa mensual de Finanzas. Con 50–100 ventas/día, **ya devuelve cifras incompletas hoy**. Fix: RPC `get_monthly_sales_totals` (SUM + GROUP BY mes).
- **A-2.** `sales.repository.ts:55` `listByDate()` — alimenta reporte diario/mensual, Finanzas y export Excel con ~10 reduce en cliente. Trunca al superar 1000 ventas en el rango (el mes está al borde). Fix: RPCs de agregación por rango + paginación keyset para el detalle.

### MEDIA
- `cash-register.repository.ts:209` `getPaymentBreakdown()` y `sales.repository.ts:37` `listBySession()` — sesión de caja >1000 ventas subestima esperados (el cierre real sí es atómico en servidor).
- `customers.repository.ts:70` `list()` — picker del POS filtra en memoria; >1000 clientes → duplicados. Fix: búsqueda en servidor con ilike + limit.
- `expenses.repository.ts:112` `listExpenses()` — comparativa 6 meses; cubrir con la misma RPC mensual.
- `products.repository.ts:97` — interpolación de `q` en `.or()` de PostgREST (inyección de filtros, acotada por RLS). Sanitizar o RPC.
- Supabase Auth: **leaked password protection desactivada** — activar en dashboard.
- Funciones sin `search_path` fijo: `register_expense_atomic`, `get_reinvestment_fund_totals`.
- Trigger functions `tg_audit_sale_discount`, `tg_consume_sale_components` ejecutables por `anon`/`authenticated` vía REST — revocar EXECUTE.

### BAJA / higiene
- Bucket `product-images` listable públicamente (quitar policy SELECT amplia; las URLs públicas no la necesitan).
- Índice duplicado en `audit_logs` (`audit_logs_tienda_created` vs `ix_audit_logs_tienda_created`).
- 4 policies RLS con `auth.<fn>()` sin `(select ...)` (re-evaluación por fila): `product_components`, `loyalty_*`.
- Policies permisivas múltiples en `audit_logs` y `product_components`.
- FKs sin índice (mayoría columnas `*_by` poco consultadas — priorizar solo si aparecen en queries).
- `.env.local` con password de Postgres en texto plano (nunca commiteado; rotar junto con la key).

### OK verificado
RLS en todas las tablas; RPCs críticos (`void_sale_atomic`, `correct_payment_atomic`, etc.) validan `auth.uid()` + rol admin dentro de la función; Edge Function `qz-sign` ejemplar; sin secretos en bundle actual; `.gitignore` correcto; guards por rol en rutas; catálogo público sin precios/costos; storage con límites de tamaño/MIME a nivel bucket.

---

## 9. Notas adicionales

- La migración se aplicó vía MCP con confirmación del dueño (regla en memoria: ya no es manual-only).
- `getKardex` usa `limit(100)` explícito — correcto para su caso de uso, no afectado.
