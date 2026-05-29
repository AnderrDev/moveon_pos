# Plan de trabajo — Hallazgos de pruebas y mejoras

Plan accionable derivado de la sesión de QA del 2026-05-27
(ver `docs/user-stories/RESULTADOS-pruebas-2026-05-27.md`). Cada item tiene origen
(TC-XX o gap conocido), causa probable, solución concreta, archivos afectados,
criterios de aceptación y esfuerzo estimado.

**Leyenda de prioridad:**
- **P0 — Bloqueante de go-live.** Sin esto no se puede operar la tienda con confianza.
- **P1 — Calidad / UX antes de go-live.** No bloquea, pero impacta operación diaria.
- **P2 — Scope MVP pendiente / nice-to-have.** Necesario para cerrar el MVP v1.0 pero no urgente.

**Leyenda de esfuerzo:** S = ≤2 h · M = 0.5–1 día · L = 1–2 días.

## Estado de ejecución (pipeline architect → developer → auditor)

| ID | Estado | Commit |
|---|---|---|
| PLAN-15 | ✅ Hecho (auditor PASS) | `aa8a166` |
| PLAN-01 | ✅ Hecho (auditor PASS) — migración pendiente de aplicar al remoto | `0e14011` |
| PLAN-05 | ✅ Hecho (auditor PASS) — pendiente QA manual del form en navegador | `778b03d` |
| PLAN-02 | ✅ Hecho (auditor PASS) — umbral por rol RN-S09 queda como TODO | `4d54541` |
| PLAN-06 | ✅ Hecho (auditor PASS) | `fda2c83` |
| PLAN-07 | ✅ Hecho (auditor PASS) — RPC con error rico queda como follow-up | `bfb5f02` |
| PLAN-04 | ✅ Hecho (auditor PASS) — el filtro ya existía; bug era sesión stale (follow-up: expirar sesiones abiertas) | `a471b91` |
| PLAN-03 | ✅ Hecho (auditor PASS) — migración aplicada al remoto (2026-05-27); pgTAP pendiente (Docker off) | `de91a89` |
| PLAN-19 | ✅ Hecho + **aplicado al remoto (2026-05-28) y verificado en navegador**: el cajero vende contra la caja del admin (V-000004), índice `ux_one_open_session_per_tienda` | `7577ee3` |
| PLAN-08 | ✅ Hecho (auditor PASS) | `4a7cc70` |
| PLAN-09 | ✅ Hecho (auditor PASS) | `9a80f75` |
| PLAN-10 | ✅ Hecho (auditor PASS) | `6c5d767` |
| PLAN-11 | ✅ Hecho (auditor PASS) | `6c5d767` |
| PLAN-14 | ✅ Hecho (auditor PASS) | `7de41dd` |
| PLAN-12 | ✅ Hecho (auditor PASS) | `(este)` |
| PLAN-13 | ✅ Hecho + **aplicado al remoto (2026-05-28) y verificado**: el `sale_exit` de V-000004 quedó con `motivo = 'Venta V-000004'` | `(aplicado)` |

> **🎉 TODO el plan de trabajo cerrado (PLAN-01 … PLAN-20).** Migraciones `20260528_001` (caja compartida) y `20260528_002` (motivo sale_exit) aplicadas al remoto y verificadas por navegador el 2026-05-28. Quedan solo pendientes NO-código: config de Supabase Auth (PLAN-16 redirect URLs), PLAN-21 (key hardcodeada en seed script), y rotación de credenciales de `.env.local`.
| PLAN-20 | ✅ Hecho (auditor PASS) — causa raíz: extracción del error del RPC | `8d41725` |
| PLAN-17 | ✅ Hecho (auditor PASS) — nombre real del cajero pendiente (requiere vista/RPC RLS-safe) | `623b2f6` |
| PLAN-16 | ✅ Hecho (auditor PASS) — pendiente config de Supabase (Redirect URLs + plantilla email) | `6d8ad3f` |
| PLAN-18 | ✅ Hecho (auditor PASS) — importador escrito + dry-run OK; correr apply contra el remoto requiere permiso | `c0e16df` |

### Hallazgo de seguridad adicional (de PLAN-18)

- **PLAN-21 (seguridad):** `scripts/seed-admin-user.mjs` tiene un **service-role key hardcodeado** (viola CLAUDE.md §2.4). Debe leerlo de `.env.local` como los demás scripts, y rotar esa key (quedó en el repo/historial). Pendiente.

> **Todos los P0 (bloqueantes go-live) completados.** Las migraciones de PLAN-01 (`20260527_001_add_tienda_timezone`) y PLAN-03 (`20260527_002_correlative_sale_number`) **ya se aplicaron al Supabase remoto (2026-05-27)** y se validaron por navegador (ver `docs/user-stories/PLAN-DE-PRUEBAS-post-fixes.md`: V-000001/V-000002 correlativos, reporte por TZ local). Pendiente menor: correr los tests pgTAP cuando Docker esté disponible.

### Hallazgos nuevos (regresión 2026-05-28, candidatos)

| ID | Título | Prioridad | Origen |
|---|---|---|---|
| PLAN-19 | Modelo de caja multi-usuario: alinear UI (por-tienda) con RPC (por-cajero). El cajero no puede vender/abrir su caja si otro usuario tiene una abierta; ve la caja ajena como propia | P0/P1 (bloquea operación con roles) | TC-R02b (F-A) |
| PLAN-20 | `sale-error-mapper` no mapea "No hay caja abierta para esta venta" → muestra genérico | P2 | TC-R02b (F-B) |


---

## Resumen ejecutivo

| # | ID | Título | Prioridad | Esfuerzo |
|---|---|---|---|---|
| 1 | PLAN-01 | Reporte diario por zona horaria local | P0 | M |
| 2 | PLAN-02 | Cliente y descuento en la venta (POS-06/POS-07) | P0 | L |
| 3 | PLAN-03 | `saleNumber` correlativo por tienda | P0 | M |
| 4 | PLAN-04 | "Ventas del turno" acotada por sesión | P0 | S |
| 5 | PLAN-05 | Formulario de producto: IVA inválido y Costo opcional | P0 | M |
| 6 | PLAN-06 | `form-currency-input` robusto ante paste/programmatic | P0 | M |
| 7 | PLAN-07 | Validación de stock en cliente + error específico | P0 | M |
| 8 | PLAN-08 | Login: mensaje en español genérico | P1 | S |
| 9 | PLAN-09 | Anular venta con modal propio + motivo validado | P1 | M |
| 10 | PLAN-10 | Pago: monto sugerido real (no placeholder) + botón "Monto exacto" | P1 | S |
| 11 | PLAN-11 | Campo "referencia" para pagos no-cash | P1 | S |
| 12 | PLAN-12 | Diálogo de cierre con Esperado vs Conteo lado a lado | P1 | M |
| 13 | PLAN-13 | Movimiento `sale_exit` con motivo descriptivo | P1 | S |
| 14 | PLAN-14 | Excluir `prepared` del cálculo de "Stock bajo" | P1 | S |
| 15 | PLAN-15 | Guard por rol (admin/cajero) en rutas y acciones | P0 | L |
| 16 | PLAN-16 | Recuperación de contraseña (Supabase Auth) | P2 | M |
| 17 | PLAN-17 | Reporte: desglose por cajero | P2 | M |
| 18 | PLAN-18 | Importador CSV Siigo (productos + clientes + stock) | P2 | L |

**Esfuerzo total estimado para cerrar P0:** ≈ 5–7 días persona.
**Para cerrar P0+P1:** ≈ 8–11 días persona.
**Para cerrar todo (MVP v1.0 completo):** ≈ 14–18 días persona.

**Ruta crítica de go-live:** PLAN-15 → PLAN-01 → PLAN-05 → PLAN-02 → PLAN-06 → PLAN-07 → PLAN-04 → PLAN-03 (en este orden por dependencias y desbloqueo).

---

## P0 — Bloqueantes de go-live

### PLAN-01 — Reporte diario por zona horaria local
- **Origen:** TC-18 (REP-01).
- **Problema:** el reporte filtra ventas por **día UTC**, mientras el operador piensa en hora Colombia (UTC−5). Las ventas hechas en la noche del día X salen registradas en el día X+1.
- **Causa probable:** el filtro construye `created_at >= dateISO` y `< dateISO+1d` en UTC, sin convertir a TZ de la tienda.
- **Solución:**
  1. En `src/modules/reports` o `apps/.../reports/reports.service.ts`, recibir un `date` (yyyy-mm-dd) y construir los límites como `[date 00:00 America/Bogota, date+1 00:00 America/Bogota]` en UTC.
  2. La TZ de la tienda debe ser configurable (campo `tiendas.timezone`, default `America/Bogota`); migración pequeña + lectura en `tienda-info.service.ts`.
  3. Mismo arreglo en cualquier query que agrupe por "día" (cierre de caja, top productos por día).
- **Archivos:** `apps/pos-angular/src/app/features/reports/reports.service.ts`, `apps/pos-angular/src/app/core/tienda/tienda-info.service.ts`, migración `supabase/migrations/<ts>_add_tienda_timezone.sql`.
- **Criterios de aceptación:**
  - Crear una venta a las 23:30 hora Colombia y verificar que aparece en el reporte de **ese mismo día**, no del siguiente.
  - Test unitario que valide el cálculo de límites para casos borde (00:00 y 23:59 local).
- **Esfuerzo:** M.

### PLAN-02 — Cliente opcional y descuentos en la venta (POS-06 + POS-07)
- **Origen:** TC-12.
- **Problema:** el POS no tiene **selector de cliente** ni **campo de descuento** (por ítem ni global), aunque el dominio y el spec lo definen.
- **Solución:**
  1. **Cliente:** botón "Asociar cliente" en el header del carrito → abre un dialog que busca por documento/nombre/teléfono (reutilizando `CustomersRepository`). Selección guarda `clienteId` en `pos-cart.store`. Mostrar nombre del cliente en el header del carrito con un "Quitar".
  2. **Descuento por ítem:** botón "%" en cada línea del carrito → input numérico (monto o porcentaje, definir). Recalcular `discountAmount` en el ítem.
  3. **Descuento global:** input en el footer del carrito o en el modal de cobro. Aplica al total.
  4. Pasar `clienteId`, `items[].discountAmount` y `totalDiscountAmount` a `create_sale_atomic` (el RPC ya los soporta según `sale-calculator`).
  5. Mostrar `discountTotal` separado en el resumen del carrito y en el ticket.
- **Archivos:** `apps/pos-angular/src/app/features/pos/pos.page.ts`, `pos-cart.store.ts`, `pos-sale.service.ts`, nuevo `customer-picker.dialog.ts`, `receipt-ticket.component.ts`.
- **Criterios de aceptación:**
  - Puedo seleccionar un cliente y la venta queda asociada (verificable en `sales.cliente_id`).
  - Puedo aplicar un descuento por ítem y/o global y el total se recalcula con IVA correcto.
  - El ticket impreso muestra el descuento y, si hay cliente, el nombre.
  - Test unitario: `sale-calculator` con descuentos por ítem + global + IVA mixto.
- **Dependencia:** ideal hacerlo después de **PLAN-15 (guard por rol)** para aplicar RN-S09 (umbral por rol). Por ahora aplicar sin umbral y registrar TODO.
- **Esfuerzo:** L.

### PLAN-03 — `saleNumber` correlativo por tienda
- **Origen:** TC-09 (RN-S).
- **Problema:** las ventas nuevas usan formato `YYMMDD-<epoch ms>` (timestamp), no consecutivo. Las históricas usan `V-YYYYMMDD-NNN` (correlativo).
- **Causa probable:** el RPC `create_sale_atomic` cambió la generación en algún punto del 2026-05 (perf o rework).
- **Solución:**
  1. Restaurar (o crear) una secuencia por `(tienda_id, día)` o por `tienda_id` global, usando `nextval` o un counter en la transacción del `create_sale_atomic`.
  2. Formato a definir: `V-YYYYMMDD-NNN` (reset diario) o `V-NNNNNN` (correlativo global por tienda). **Recomendación:** correlativo global por tienda — más simple y resistente a cambios de TZ.
  3. Migración para crear `sequence` o tabla counter; backfill no necesario (las ventas viejas con timestamps quedan como están).
- **Archivos:** `supabase/migrations/<ts>_restore_correlative_sale_number.sql`, `supabase/migrations/<existing> create_sale_atomic.sql` (modificar RPC).
- **Criterios de aceptación:**
  - Cada venta nueva recibe un número estrictamente mayor que la anterior en la misma tienda.
  - Test pgTAP que cree 3 ventas consecutivas y verifique consecutivo.
  - Reimprimir un ticket viejo (timestamp-based) sigue funcionando.
- **Esfuerzo:** M.

### PLAN-04 — "Ventas del turno" acotada por la sesión activa
- **Origen:** TC-09.
- **Problema:** el modal "Ventas del turno" muestra ventas de varios días, no solo de la `cash_session` actual.
- **Causa probable:** el query no filtra por `cash_session_id` o usa un rango de fecha amplio.
- **Solución:**
  1. En `sales.repository` (o el método que alimenta el dialog), filtrar `where cash_session_id = <sesión actual>`.
  2. Cambiar el título del dialog a "Ventas del turno actual" si se quiere ser explícito.
- **Archivos:** `apps/pos-angular/src/app/features/pos/sales-history.dialog.ts`, `sales.repository.ts`.
- **Criterios de aceptación:**
  - Tras abrir caja y hacer 1 venta, "Ventas del turno" muestra exactamente esa venta.
  - Tras cerrar y reabrir, "Ventas del turno" arranca vacío.
- **Esfuerzo:** S.

### PLAN-05 — Formulario de producto: IVA inválido + Costo opcional
- **Origen:** TC-04.
- **Problema:**
  - El select de IVA muestra **"Invalid input"** desde la apertura del formulario y persiste tras seleccionar opciones.
  - El campo Costo (opcional según spec) trata vacío como inválido ("Ingresa un valor numérico").
- **Causa probable:**
  - El control reactive form de IVA inicia con `null/undefined` mientras el `<select>` muestra "0% (exento)" → Zod schema rechaza `undefined`. Falta un valor inicial (`19` o `0`) en el form factory.
  - El campo Costo usa `z.number()` cuando debería ser `z.coerce.number().optional()` o transformar `''` → `undefined` antes de validar.
- **Solución:**
  1. Revisar `src/modules/products/forms/product-form.factory.ts` y `product-form-schema`:
     - Inicializar `ivaTasa` con un valor válido (default 19).
     - Permitir `costo` opcional con transform `'' → undefined`.
  2. Verificar que las `option value` del `<select>` sean los números (no strings con "%").
  3. Asegurar que el control se enlaza por `[ngValue]="0"` etc.
- **Archivos:** `src/modules/products/forms/product-form-schema.ts`, `product-form.factory.ts`, `product-form.mapper.ts`, `apps/pos-angular/src/app/features/products/product-form.dialog.ts`.
- **Criterios de aceptación:**
  - Abrir el formulario nuevo: el IVA arranca con un valor válido y sin mensaje "Invalid input".
  - Dejar Costo vacío: el formulario acepta crear el producto.
  - Test unitario del schema que verifique los casos borde.
- **Esfuerzo:** M.

### PLAN-06 — `form-currency-input` robusto ante paste y programmatic input
- **Origen:** TC-16.
- **Problema:** rellenar el input con `HTMLInputElement.value` (paste, autofill, Playwright `fill()`) deja valores cosméticos absurdos ($100.000.000 cuando se escribió 2.527.560). Solo `pressSequentially` + `Tab` blur funciona.
- **Causa probable:** el componente escucha solo `(keydown)` o `(input)` durante tipeo, no `(paste)` ni cambios programáticos a `.value`. La normalización al blur no re-parsea correctamente cualquier raw value.
- **Solución:**
  1. En `apps/pos-angular/src/app/shared/forms/form-currency-input.component.ts`, manejar `(paste)`, normalizar siempre el valor del DOM al cambio (no solo en tipeo).
  2. La función de parseo debe aceptar tanto el formato display (`$ 2.533.560`) como raw (`2533560`) y producir un número limpio.
  3. Agregar tests en `tests/unit/shared/forms/form-currency-input.test.ts` que cubran: paste de cantidad, fill programmatic, valores con $ y puntos.
- **Archivos:** `apps/pos-angular/src/app/shared/forms/form-currency-input.component.ts`, `tests/unit/shared/forms/form-currency-input.test.ts`.
- **Criterios de aceptación:**
  - Pegar "2533560" o "$ 2.533.560" en el input produce valor 2533560.
  - Tests existentes siguen pasando, nuevos cubren paste + fill.
  - Verificación manual: el flujo de cierre de caja se puede completar pegando montos sin problemas.
- **Esfuerzo:** M.

### PLAN-07 — Validación de stock en cliente + error específico del servidor
- **Origen:** TC-13.
- **Problema:**
  - El botón "+" del carrito permite superar el stock disponible sin advertir.
  - Cuando el RPC rechaza la venta, la UI solo muestra "Error al crear venta" — genérico, sin nombrar producto/cantidad.
- **Solución:**
  1. **Cliente:** en `pos-cart.store`, el `+` consulta el stock del producto (via cache de productos) y topa al máximo, mostrando un toast/badge "Stock máximo: N".
  2. **Servidor → UI:** mapear los errores del RPC (`InsufficientStock { productoId, available, requested }`, `CashSessionNotOpen`, `PaymentTotalMismatch`) a mensajes claros en `pos-sale.service.ts`. Mostrar el nombre del producto y la cantidad disponible.
  3. Tipar los errores del dominio con `Result<T,E>` y propagar al presenter.
- **Archivos:** `apps/pos-angular/src/app/features/pos/pos-cart.store.ts`, `pos-sale.service.ts`, `pos.page.ts`, `src/modules/sales/...` (errores tipados).
- **Criterios de aceptación:**
  - Intentar agregar más unidades que el stock → toast "Stock máximo: 9 unidades" y el + queda inactivo.
  - Si por carrera otro cliente vende justo antes, el RPC rechaza y la UI muestra "Stock insuficiente para Caseína 2lb: disponible 8, solicitado 9".
- **Esfuerzo:** M.

### PLAN-15 — Guard por rol (admin/cajero) en rutas y acciones
- **Origen:** AUTH-04 (gap conocido pre-existente).
- **Problema:** solo existe `authGuard`. Un usuario cajero hoy puede entrar a `/productos`, `/inventario`, anular ventas, etc.
- **Solución:**
  1. Crear `roleGuard(...allowed: Role[])` en `apps/pos-angular/src/app/core/auth/role.guard.ts` que lea el rol del `SessionService` (de `user_tiendas.rol`).
  2. Aplicar `canActivate: [authGuard, roleGuard('admin')]` a rutas admin: `/productos`, `/productos/categorias`, `/inventario`, `/reportes`.
  3. En servicios sensibles (descuentos por arriba de umbral, anular, ajustar stock) validar rol antes de invocar RPC. Estos van además del RLS (que también debe filtrar por rol — verificar policies actuales).
  4. UI: ocultar/deshabilitar botones según rol (ej. "Anular" solo visible si admin).
- **Archivos:** `apps/pos-angular/src/app/core/auth/role.guard.ts` (nuevo), `app.routes.ts`, `session.service.ts`, varios componentes de feature.
- **Criterios de aceptación:**
  - Login como cajero → no se puede navegar a `/productos`; el botón "Anular" en POS no se muestra.
  - Login como admin → todo accesible.
  - Test de integración con dos usuarios (admin + cajero).
- **Dependencia:** habilita el umbral por rol de PLAN-02 (descuentos).
- **Esfuerzo:** L.

---

## P1 — Calidad y UX antes de go-live

### PLAN-08 — Login: mensaje en español genérico
- **Origen:** TC-01.
- **Problema:** muestra "Invalid login credentials" en inglés.
- **Solución:** en `login.page.ts` / presenter, mapear el error de Supabase a "Email o contraseña incorrectos". No exponer cuál falló.
- **Archivos:** `apps/pos-angular/src/app/features/auth/login.page.ts`.
- **Esfuerzo:** S.

### PLAN-09 — Anular venta con modal propio + motivo validado
- **Origen:** TC-15.
- **Problema:** usa `window.prompt()` nativo; no valida longitud mínima.
- **Solución:** reemplazar por un `mo-dialog` con textarea, validar mínimo 10 caracteres (consistente con RN-I03), botón "Anular" deshabilitado hasta que el motivo cumpla.
- **Archivos:** `apps/pos-angular/src/app/features/pos/sales-history.dialog.ts` (nuevo dialog hijo o componente inline).
- **Esfuerzo:** M.

### PLAN-10 — Monto de pago: valor real, no placeholder
- **Origen:** TC-11.
- **Problema:** el textbox del pago muestra el monto faltante como **placeholder**, no como valor; pulsar "Agregar" sin escribir no agrega nada aunque parezca que sí.
- **Solución:** prefilling real del input con el monto faltante (o efectivo del cliente). El botón "Monto exacto" debería **agregar directamente** sin requerir pulsar "Agregar" después.
- **Archivos:** modal de cobro en `pos.page.ts` o subcomponente.
- **Esfuerzo:** S.

### PLAN-11 — Campo "referencia" para pagos no-cash
- **Origen:** TC-11 (RN-PG04).
- **Problema:** al seleccionar Nequi/Tarjeta/Daviplata/Transferencia no aparece campo de referencia (últimos 4 de tarjeta, # aprobación, etc.).
- **Solución:** mostrar campo "Referencia" (opcional pero recomendado) solo cuando el método no es `cash`. Persistir en `payments.referencia`.
- **Archivos:** modal de cobro en `pos.page.ts`.
- **Esfuerzo:** S.

### PLAN-12 — Diálogo de cierre con "Esperado vs Conteo"
- **Origen:** TC-16.
- **Problema:** el cajero tipea a ciegas — el diálogo no muestra los montos esperados por método.
- **Solución:** mostrar en cada fila del diálogo `Esperado | Conteo | Diferencia` con color (verde si 0, rojo si distinto). Reusable también para preview previo al cierre.
- **Archivos:** `apps/pos-angular/src/app/features/cash-register/close-session.dialog.ts`.
- **Esfuerzo:** M.

### PLAN-13 — `sale_exit` con motivo descriptivo
- **Origen:** TC-09.
- **Problema:** los movimientos `sale_exit` generados por ventas nuevas tienen motivo vacío ("—"); los seed muestran "Venta".
- **Solución:** en `create_sale_atomic`, fijar `motivo = 'Venta ' || sale_number` (o equivalente). Migración pequeña que actualice el RPC.
- **Archivos:** `supabase/migrations/<ts>_sale_exit_motivo.sql`.
- **Esfuerzo:** S.

### PLAN-14 — Excluir `prepared` de "Stock bajo"
- **Origen:** INV-05 / REP-02.
- **Problema:** los batidos `prepared` (stock 0, min 0) aparecen como "Stock bajo", aunque no manejan stock.
- **Solución:** en `ListLowStockUseCase` / query, excluir productos con `tipo = 'prepared'`. Mismo cambio en `/reportes`.
- **Archivos:** `src/modules/inventory/...`, `apps/.../reports/reports.service.ts`.
- **Esfuerzo:** S.

---

## P2 — Scope MVP pendiente / nice-to-have

### PLAN-16 — Recuperación de contraseña (Supabase Auth)
- **Origen:** AUTH-05.
- **Problema:** no hay UI de "Olvidé mi contraseña".
- **Solución:** botón en `/login` → modal que pide email → `supabase.auth.resetPasswordForEmail`. Diseñar plantilla de correo en Supabase. Página de "nueva contraseña" tras click en el link.
- **Archivos:** `login.page.ts`, nueva `reset-password.page.ts`, configuración Supabase Auth email template.
- **Esfuerzo:** M.

### PLAN-17 — Reporte: desglose por cajero
- **Origen:** REP-01 CA2 (M8).
- **Problema:** el reporte diario no desglosa ventas por cajero.
- **Solución:** agrupar también por `cashier_id` y mostrar nombre del usuario. Útil para conciliación y trazabilidad.
- **Archivos:** `reports.service.ts`, `reportes.page.ts`.
- **Esfuerzo:** M.

### PLAN-18 — Importador CSV Siigo (productos + clientes + stock)
- **Origen:** CAT-04 / M9 (Sprint 5).
- **Problema:** sin importador, la única vía de cargar el catálogo es manual — y el form de producto está roto (ver PLAN-05).
- **Solución:**
  1. CLI script en `scripts/import-siigo-csv.mjs` que use service role (no en cliente).
  2. Formato esperado: `nombre, sku, codigo_barras, categoria, tipo, unidad, precio_venta, costo, iva_tasa, stock_inicial`.
  3. Validación previa con reporte de errores antes de insertar.
  4. Inserta categorías faltantes, productos y `inventory_movements` tipo `entry` con motivo "Stock inicial migración Siigo".
- **Archivos:** `scripts/import-siigo-csv.mjs` (nuevo).
- **Dependencia:** se beneficia de PLAN-05 estable (form de producto) si se hace una UI complementaria.
- **Esfuerzo:** L.

---

## Cómo proponemos avanzar

**Sprint inmediato (esta semana):** PLAN-15 → PLAN-05 → PLAN-04 → PLAN-13 → PLAN-08 → PLAN-14.
Justificación: PLAN-15 desbloquea otros, PLAN-05 desbloquea poder cargar catálogo, los demás son fixes rápidos de alto impacto.

**Sprint siguiente:** PLAN-01 → PLAN-06 → PLAN-07 → PLAN-03 → PLAN-09 → PLAN-10 → PLAN-11 → PLAN-12.

**Sprint 5 (cierre MVP):** PLAN-02 (cliente/descuento) → PLAN-18 (CSV) → PLAN-16 (reset password) → PLAN-17 (reporte por cajero).

Cada PLAN-XX debe convertirse en un issue/PR independiente (uno ≈ un PR pequeño). Antes de pushar cada fix corresponde:
- Reproducir el caso de prueba original (TC-XX) en QA manual.
- Cubrir el escenario con test unitario o de integración.
- Re-ejecutar el guion E2E al cierre del sprint.
