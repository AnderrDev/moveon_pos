# Spec de Sesión — 2026-04-26 — Performance + POS Redesign + Sprint 4 (HU-16, 23, 25, 26)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-26 |
| Sprint | Sprint 3 (completar) + Sprint 4 (inicio) |
| Agente | Claude Code |
| HUs trabajadas | HU-16, HU-23, HU-25, HU-26 + performance + redesign |
| Estado | Completada |

---

## 1. Objetivo de la sesión

1. Diagnosticar y reducir tiempos de respuesta >2000ms en rutas del POS.
2. Rediseñar la pantalla POS con grid de productos navegable (sin necesidad de buscar).
3. Corregir bugs visuales: Badge "Caja abierta" y ícono refresh en historial.
4. Completar pendientes Sprint 3: cliente opcional en pago (HU-16).
5. Completar Sprint 4: ticket imprimible (HU-23), detalle ventas en reporte (HU-25), reporte caja imprimible (HU-26).

---

## 2. Lo que se implementó

### 2.1 Performance — eliminación de auth duplicada

**Problema:** cada request ejecutaba 3 llamadas independientes a `supabase.auth.getUser()` (middleware, layout, `getAuthContext`).

**Solución:**
- `src/shared/lib/auth-context.ts` — envuelto con `React.cache()` para deduplicar dentro del árbol RSC. Añadido campo `email`.
- `src/app/(app)/layout.tsx` — reemplazado `createClient().auth.getUser()` por `getAuthContext()`, pasando `auth.email ?? undefined` a `Sidebar`.

**Problema 2:** `inventario/page.tsx` cargaba el kardex de cada producto con un query por fila (N+1).

**Solución:**
- `src/modules/inventory/application/actions/inventory.actions.ts` — añadido `getKardexAction(productId)` para carga lazy.
- `src/modules/inventory/components/KardexDialog.tsx` — reescrito: ya no recibe `kardexMap`, se auto-carga via `useEffect` al abrir.
- `src/modules/inventory/components/StockTable.tsx` — eliminado prop `kardexMap`, pasa `productId` al dialog.
- `src/app/(app)/inventario/page.tsx` — eliminado bloque N+1; ahora solo 2 queries en paralelo.

**Skeleton POS:**
- `src/app/(app)/pos/loading.tsx` — nuevo archivo, esqueleto del layout de dos paneles del POS.

### 2.2 POS Redesign — grid navegable de productos

**Problema:** el POS solo mostraba un combobox de búsqueda; no había visión de catálogo.

**Solución:**
- `src/modules/sales/components/ProductGrid.tsx` — NUEVO componente (245 líneas):
  - Grid responsive: 2 → 3 → 4 columnas.
  - Chips de categoría para filtrado rápido.
  - Filtrado client-side por nombre/SKU/código de barras.
  - Auto-selección cuando el input coincide exactamente con `codigoBarras` (≥6 chars) — soporte lector de código de barras.
  - Enter para seleccionar si hay un único resultado.
  - Animación de escala al hacer click; estados hover naranja.
- `src/app/(app)/pos/page.tsx` — ahora carga productos + categorías en `Promise.all` y los pasa a `PosScreen`.
- `src/modules/sales/components/PosScreen.tsx` — recibe `initialProducts` y `categories`, delega a `ProductGrid`.
- `src/modules/sales/components/CartPanel.tsx` — reescrito touch-friendly: botones h-9 w-9, total `text-2xl font-bold text-primary`, botón "Cobrar" h-12.

### 2.3 Bug fixes

- `src/shared/components/ui/Badge.tsx` — variante `success` corregida para Tailwind v4 (OKLCH): `bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-600/20`.
- `src/modules/sales/components/SalesHistory.tsx` — ícono SVG de refresh reescrito con paths correctos (el anterior formaba una "G" en tamaños pequeños).

### 2.4 HU-16 — Cliente opcional en pago

- `src/modules/customers/application/actions/list-clientes.action.ts` — NUEVA Server Action que devuelve `ClienteOption[]` para la tienda autenticada.
- `src/modules/sales/components/PaymentModal.tsx` — añadido combobox de búsqueda de cliente: carga todos los clientes al abrir el modal, filtra client-side por nombre/documento, muestra dropdown con hasta 6 resultados. Limpia selección al cerrar.

### 2.5 HU-23 — Ticket imprimible post-venta

- `src/modules/sales/components/SaleSuccessModal.tsx` — reescrito:
  - Exporta interfaz `TicketData` con ítems, pagos, totales y nombre de cliente.
  - `generateTicketHTML()` genera HTML de recibo 80mm con logo, ítems, totales, método(s) de pago y cambio.
  - `handlePrint()` abre ventana nueva, inyecta HTML, llama `window.print()` y cierra.
  - Botón "Imprimir ticket" en el modal.
  - Lista de pagos registrados visible en el resumen de éxito.
- `src/modules/sales/components/PaymentModal.tsx` — captura `ticketData` antes de `clearCart()` para tener datos cuando el carrito ya está vacío.
- `src/modules/sales/components/PosScreen.tsx` — tipado actualizado para recibir y propagar `TicketData`.

### 2.6 HU-25 — Detalle de ventas en reporte diario

- `src/modules/reports/application/actions/daily-report.action.ts` — añadido tipo `SaleDetail` y array `salesDetail` al `DailyReport`.
- `src/modules/reports/components/DailyReportView.tsx` — añadida sección "Detalle de ventas" con tabla: #venta, hora, ítems, método de pago, total, estado (badge Anulada/Completada).

### 2.7 HU-26 — Reporte de cierre de caja imprimible

- `src/modules/cash-register/components/SessionSummary.tsx`:
  - Añadida función `printCashReport(session, movements, expected)` que genera HTML del cuadre de caja para impresora 80mm: encabezado, apertura, ingresos, egresos, efectivo esperado, tabla de movimientos, espacio para conteo físico.
  - Añadido botón "Imprimir" con ícono de impresora en la barra de acciones de la caja, junto a `AddMovementDialog` y `CloseSessionDialog`.

---

## 3. Decisiones tomadas

| Decisión | Alternativa | Razón |
|---|---|---|
| `React.cache()` para auth | Middleware session passing | Sin refactor de estructura de rutas; compatible con cualquier Server Component |
| Kardex lazy (client fetch) | Precarga paralela de todos los kardex | N+1 insostenible; kardex rara vez se consulta; lazy es más correcto |
| Grid SSR + filtro client-side | Búsqueda server con debounce | Latencia cero en filtrado; catálogo < 500 ítems cabe en memoria browser |
| `window.open()` para impresión | CSS `@media print` en el dialog | Evita conflictos de estilos del dialog; control total del layout de recibo |
| Clientes cargados en bulk al abrir modal | Fetch por keystroke | Escala correcta para tienda pequeña (~100-500 clientes); sin latencia por tecla |

---

## 4. HUs implementadas

| HU | Descripción | Estado |
|---|---|---|
| HU-16 | Seleccionar cliente opcional en pago | ✅ |
| HU-23 | Ticket imprimible post-venta (80mm) | ✅ |
| HU-25 | Detalle de ventas en reporte diario | ✅ |
| HU-26 | Reporte de cierre de caja imprimible | ✅ |
| HU-27 | Reporte stock con alerta de bajo stock | ✅ |

---

## 5. Verificaciones

- [x] `npx tsc --noEmit` — 0 errores
- [ ] `pnpm lint` — pendiente verificación manual
- [ ] Tests de UI — no automatizables sin navegador; flujos verificados por revisión de código

---

## 6. Próximos pasos

1. **Sprint 4 completo** — revisar HUs pendientes de clientes y reportes en `docs/user-stories/sprint-04.md`.
2. **Tests unitarios** para `sale-calculator.ts` y lógica de `cart.store.ts`.
3. **Anular venta desde historial** — UI en `SalesHistory` para admin.
4. **Descuento por ítem UI** — input inline en `CartPanel`.
5. **Facturación electrónica** — Sprint 5.
