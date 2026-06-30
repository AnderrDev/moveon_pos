# Plan de trabajo — Hallazgos de pruebas y mejoras

Plan accionable derivado de la sesión de QA del 2026-05-27
(ver `docs/user-stories/RESULTADOS-pruebas-2026-05-27.md`) y rebaselinado tras
la decisión de inventario por ubicación (ADR 0008).

> **Snapshot 2026-05-30:** PLAN-01..26 están cerrados localmente. El bloque activo
> nuevo es PLAN-27..37: remediación de auditoría integral de arquitectura,
> seguridad, patrones y mantenibilidad.

**Leyenda de prioridad:**
- **P0 — Bloqueante de go-live.** Sin esto no se puede operar la tienda con confianza.
- **P1 — Calidad / UX antes de go-live.** No bloquea, pero impacta operación diaria.
- **P2 — Scope MVP pendiente / nice-to-have.** Necesario para cerrar el MVP v1.0 pero no urgente.

**Leyenda de esfuerzo:** S = ≤2 h · M = 0.5–1 día · L = 1–2 días.

## Estado de ejecución (pipeline architect → developer → auditor)

| ID | Estado | Commit |
|---|---|---|
| PLAN-15 | ✅ Hecho (auditor PASS) | `aa8a166` |
| PLAN-01 | ✅ Hecho + aplicado al remoto y verificado por navegador | `0e14011` |
| PLAN-05 | ✅ Hecho + QA manual PASS | `778b03d` |
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
| PLAN-21 | ✅ Hecho — script seed lee service role desde `.env.local`; rotación de key pendiente por usuario | `86cac38` |
| PLAN-22 | ✅ Hecho — rebaseline documental y `.codex/` ignorado | `(este)` |
| PLAN-23 | ✅ Hecho — migraciones de inventario por ubicación + RPCs | `(este)` |
| PLAN-24 | ✅ Hecho — tipos/dominio/DTO/importador/tests | `(este)` |
| PLAN-25 | ✅ Hecho — UI de inventario por ubicación + traslado admin | `(este)` |
| PLAN-26 | ✅ Hecho — POS/reportes consumen stock de punto de venta | `(este)` |
| PLAN-27 | ⏳ Pendiente — seguridad RLS/RPC admin-only | `(pendiente)` |
| PLAN-28 | ⏳ Pendiente — descuentos por rol en servidor | `(pendiente)` |
| PLAN-29 | ⏳ Pendiente — E2E Playwright minimo MVP | `(pendiente)` |
| PLAN-30 | ⏳ Pendiente — dividir `pos.page.ts` | `(pendiente)` |
| PLAN-31 | ⏳ Pendiente — repositorios Angular + `Result` | `(pendiente)` |
| PLAN-32 | ⏳ Pendiente — dividir importador Siigo | `(pendiente)` |
| PLAN-33 | ✅ Hecho (auditor PASS) — alcance acotado a `/reportes` (caja/cierre quedó fuera, ver decisión del arquitecto en `docs/sessions/2026-06-23-plan-33-dividir-reportes.md`); `reportes.page.ts` 1043→277 líneas, 8 componentes nuevos + helpers | `(sin commit aún)` |
| PLAN-34 | ⏳ Pendiente — formularios factory/mapper/presenter | `(pendiente)` |
| PLAN-35 | ⏳ Pendiente — errores tipados por modulo | `(pendiente)` |
| PLAN-36 | ⏳ Pendiente — limpieza documental legacy/runtime config | `(pendiente)` |
| PLAN-37 | ⏳ Pendiente — placeholders, TODOs y fixtures | `(pendiente)` |
| PLAN-38 | ✅ Hecho — sección "Tendencia" en `/reportes` (ventas por hora + por día, dominio puro `sales-trend.ts`, sin nueva query) | `(sin commit aún)` |
| PLAN-39 | ✅ Hecho — tabla completa "Top productos" en `/reportes`, ordenable por unidades/facturación (dominio puro `top-products.ts`, sin nueva query) | `(sin commit aún)` |
| PLAN-40 | ⏳ Pendiente — método de pago por rango de fechas | `(pendiente)` |
| PLAN-41 | ✅ Hecho — conciliación histórica de caja: `cash-closures-table.component.ts` extendida con cajero (UUID truncado), notas de cierre, badge "En curso" para sesiones abiertas, y resaltado de fila completa cuando hay diferencia | `(sin commit aún)` |
| PLAN-42 | ✅ Hecho — ventas anuladas en `/reportes`: filtro de estado (Todas/Completadas/Anuladas) en la sub-sección "Ventas" del tab Ventas; reutiliza `mo-sale-detail-list` (ya mostraba motivo de anulación al expandir) sin componente nuevo | `(sin commit aún)` |
| PLAN-43 | ⏳ Pendiente — vistas SQL para agregados pesados (evaluar cuando aplique) | `(pendiente)` |
| PLAN-44 | ✅ Hecho (auditor PASS) y verificado end-to-end en producción — corregir apertura de caja (`opening_amount`) con auditoria. Migración `20260623_001_correct_cash_session_opening.sql` aplicada al remoto (versión `20260623174042`); pgTAP local sigue bloqueado por deuda técnica preexistente en nombres de archivo de migraciones `20260426_*` (ver sesión); de paso se corrigió un bug de reactividad preexistente en `form-currency-input.component.ts` que afectaba el prellenado de montos por defecto | `(sin commit aún)` |
| PLAN-45 | ✅ Hecho — buscador de producto en `/reportes` (cuándo y en qué ventas se vendió) | `(sin commit aún)` |
| PLAN-46 | ⏳ Pendiente — reparar nombres de archivo de `supabase/migrations/20260426_001/_002/_003*.sql`: comparten el mismo prefijo de versión de 8 dígitos, así que `supabase start`/`db reset` choca por clave duplicada al inicializar una base local desde cero. El remoto ya tiene versiones de 14 dígitos correctas (reparadas 2026-06-17); los archivos locales nunca se renombraron para coincidir. Bloquea correr pgTAP local hasta resolverse. Ver `docs/sessions/2026-06-23-plan-44-corregir-apertura-caja.md` §10 | `(pendiente)` |

### Hallazgo de seguridad adicional (de PLAN-18)

- **PLAN-21 (seguridad):** ✅ Hecho (`86cac38`) — `scripts/seed-admin-user.mjs` ya lee URL + service-role de `.env.local` (sin hardcode). **⚠️ Falta acción del usuario: ROTAR el service-role key** (sigue en el historial de git, válido hasta 2092).
- **PLAN-22 (seguridad local):** ✅ Hecho — `.codex/` queda ignorado porque puede contener tokens MCP locales.

> **Todos los P0 del bloque QA 2026-05-27 quedaron completados.** Las migraciones de PLAN-01 (`20260527_001_add_tienda_timezone`) y PLAN-03 (`20260527_002_correlative_sale_number`) **ya se aplicaron al Supabase remoto (2026-05-27)** y se validaron por navegador (ver `docs/user-stories/PLAN-DE-PRUEBAS-post-fixes.md`: V-000001/V-000002 correlativos, reporte por TZ local). El bloque nuevo de auditoría abre nuevos P0: PLAN-27 y PLAN-28.

### Hallazgos nuevos (regresión 2026-05-28, resueltos)

| ID | Título | Prioridad | Origen |
|---|---|---|---|
| PLAN-19 | Caja compartida por tienda | ✅ Resuelto | TC-R02b (F-A) |
| PLAN-20 | Mapper de error de caja abierta | ✅ Resuelto | TC-R02b (F-B) |

### Bloque activo — Inventario por ubicación (ADR 0008)

| ID | Título | Prioridad | Criterio de cierre |
|---|---|---|---|
| PLAN-22 | Rebaseline documental y seguridad local | P0 | Docs vivas coherentes; `.codex/` ignorado; ADR 0008 trackeado |
| PLAN-23 | DB/RPC de inventario `punto_venta`/`bodega` | P0 | `get_stock` por ubicación, ventas/anulaciones en PV, traslado atómico admin-only |
| PLAN-24 | Dominio, DTOs, tipos e importador | P0 | `StockLevel` por ubicación; Siigo entra a bodega; tests unitarios |
| PLAN-25 | UI inventario por ubicación | P0 | Tabla PV/Bodega/Total, entrada/ajuste con ubicación, diálogo traslado, kardex con ubicación |
| PLAN-26 | POS/reportes/regresión | P0 | POS usa PV como stock vendible; reportes muestran PV/Bodega/Total |

### Bloque activo — Remediación de auditoría integral

Plan detallado: `docs/audits/2026-05-30-plan-accion-auditoria-arquitectura.md`.

| ID | Título | Prioridad | Criterio de cierre |
|---|---|---|---|
| PLAN-27 | Seguridad RLS/RPC para operaciones admin-only | P0 | Cajero no puede mutar productos/categorías/inventario por API directa; admin conserva operación; tests SQL por rol |
| PLAN-28 | Descuentos por rol en flujo POS real | P0 | RPC bloquea descuentos no autorizados; UI muestra error claro; tests admin/cajero |
| PLAN-29 | E2E Playwright mínimo de regresión MVP | P1 | `corepack pnpm test:e2e` ejecuta flujo caja → inventario PV/Bodega → POS → anulación → reportes |
| PLAN-30 | Dividir `pos.page.ts` | P1 | `pos.page.ts` y componentes nuevos bajo 300 líneas; flujo POS sin regresión |
| PLAN-31 | Repositorios Angular alineados con `Result` | P1 | Repositories sensibles devuelven `Result` o adapters compatibles; errores mapeados |
| PLAN-32 | Dividir importador Siigo | P1 | Parser/validator/mapper separados; API pública y tests conservados |
| PLAN-33 | Dividir reportes, caja y cierre | P2 | Componentes standalone + OnPush bajo 300 líneas; comportamiento igual |
| PLAN-34 | Formularios factory/mapper/presenter | P2 | Formularios inventario/caja migrados al patrón de 3 archivos con tests |
| PLAN-35 | Errores tipados por módulo | P2 | Use-cases retornan errores discriminados, no `Error` genérico de negocio |
| PLAN-36 | Limpieza documental legacy y runtime config | P2 | Docs fuente coherentes con Angular/runtime config; docs históricas preservadas |
| PLAN-37 | Limpieza de placeholders, TODOs y fixtures | P3 | Carpetas vacías justificadas o eliminadas; TODOs convertidos en PLANs |

**Gate de go-live recomendado:** PLAN-27, PLAN-28 y PLAN-29 cerrados.  
**Gate de mantenibilidad MVP:** PLAN-30, PLAN-31 y PLAN-32 cerrados.

### Bloque activo — Reportes operativos avanzados (sesión 2026-06-23)

Origen: análisis de estado del negocio y horario de apertura/cierre hecho a mano vía
SQL directo sobre Supabase (ver `docs/sessions/2026-06-22-reporte-sql-estado-negocio.md`
y `docs/sessions/2026-06-23-analisis-horario-apertura-cierre.md`). El módulo `/reportes`
hoy es 100% tabular y todo el cálculo es client-side (sin vistas/RPC SQL agregadas).
Scope movido de v1.4 a MVP actual en `docs/01-mvp-scope.md` (M8) — decisión confirmada
con el usuario el 2026-06-23. Sin gráficos por ahora (decisión confirmada): solo tablas,
para no introducir una dependencia nueva sin ADR previo.

**Dependencia:** ejecutar después de **PLAN-33** (dividir `reportes.page.ts`) para no
seguir agregando secciones a un archivo que ya está sobre el límite de 300 líneas.

| ID | Título | Prioridad | Criterio de cierre |
|---|---|---|---|
| PLAN-38 | Ventas por hora + tendencia por día | P2 | Sección "Tendencia" en `/reportes`: tabla de ventas por hora del día y por día del periodo seleccionado; reusa `day-range.ts` |
| PLAN-39 | Top productos por periodo | P2 | Tabla de productos del periodo seleccionado ordenable por unidades/facturación; reusa `SalesRepository` |
| PLAN-40 | Método de pago por rango de fechas | P3 | Confirmar si el desglose por método ya soporta rango (hoy solo se confirmó para el día); extenderlo si no |
| PLAN-41 | ✅ Hecho — Conciliación histórica de caja | P2 | Tabla de sesiones del periodo con Esperado/Conteo/Diferencia; fila resaltada si diferencia ≠ 0 |
| PLAN-42 | ✅ Hecho — Ventas anuladas en `/reportes` | P3 | Filtro de estado sobre `mo-sale-detail-list` (sub-sección "Ventas"); motivo, fecha y cajero ya visibles al expandir una venta anulada |
| PLAN-43 | Vistas SQL para agregados pesados | P3 | Solo evaluar si el cálculo client-side empieza a degradar rendimiento con más volumen; no bloquea los anteriores |
| PLAN-45 | ✅ Hecho — Buscador de producto en `/reportes` | P2 | `product-sales-search.component.ts`: input de búsqueda por nombre/SKU sobre `saleItems` ya cargado (sin queries nuevas), tabla con fecha, venta, cantidad, total, cajero y estado de cada movimiento donde aparece el producto en el período seleccionado |

### Bloque activo — Corrección de apertura de caja (incidente 2026-06-22)

Origen: la noche del 2026-06-22 la caja se abrió con `opening_amount = 50.000` en vez de
~23.200 por error de digitación. La única forma de corregirlo fue editar `opening_amount`
directo en la base de datos (sin RPC, sin `audit_logs`), porque la app no ofrece una vía
auditada para esto. El usuario también probó primero crear movimientos `correction` y
anularlos (no era la herramienta correcta — un `cash_movement` no toca `opening_amount`).
Mismo patrón de raíz que `void_cash_movement_atomic` (`20260619_001`): falta una operación
estructurada con auditoría para una corrección legítima y frecuente.

| ID | Título | Prioridad | Criterio de cierre |
|---|---|---|---|
| PLAN-44 | ✅ Hecho (auditor PASS) — Corregir apertura de caja (`opening_amount`) con auditoría | P1 | RPC `correct_cash_session_opening_atomic` (espejo de `void_cash_movement_atomic`): solo mientras `status = 'open'`, cualquier usuario activo de la tienda (caja compartida, igual que `close_cash_session_atomic`/PLAN-19 — no admin-only, no solo el dueño), motivo obligatorio, guarda `opening_amount` anterior/nuevo en `audit_logs` (`cash_session.opening_corrected`). UI: acción "Corregir apertura" en `caja.page.ts` con diálogo de confirmación (monto nuevo + motivo). Tests SQL (pgTAP) y unit del DTO/mapper. |

---

## Resumen ejecutivo histórico — bloque QA 2026-05-27

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
