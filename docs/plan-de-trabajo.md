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
| PLAN-46 | ✅ Hecho (2026-07-16) — las 47 migrations locales renombradas a las versiones de 14 dígitos del remoto (`supabase_migrations.schema_migrations`); 4 locales sin registro remoto recibieron versiones sintéticas que preservan el orden; recreado `20260705040508_register_expense_atomic_defaults.sql` (existía solo en remoto); reparadas 3 migraciones que fallaban en base vacía (datos de tienda prod condicionados, `update_updated_at_column` idempotente, columnas de `audit_logs` convergentes) + nueva `20260716000200_table_grants_parity.sql` (grants DML estándar que el remoto tenía y el local no). `supabase start`/`db reset` inicializan desde cero sin errores. Ver `docs/sessions/2026-07-16-loyalty-pendientes-y-supabase-local.md` | `(sin commit aún)` |
| PLAN-47 | ✅ Hecho — módulo Finanzas (`/finanzas`, solo admin): migration `20260704_002_expenses_module.sql` (empleados, expense_categories, expenses, expense_templates + RLS admin-only + seed de 8 categorías), dominio `src/modules/expenses` (`buildFinancialSummary` puro), resumen Entradas − Costo − Gastos = Utilidad neta con % por categoría, CRUD de gastos con anulación auditada. Ver `docs/sessions/2026-07-04-plan-modulo-gastos-finanzas.md` | `(sin commit aún)` |
| PLAN-48 | ✅ Hecho — nómina simulada (sin DIAN/legal): CRUD de empleados con salario acordado, flujo "Pagar" (mes/quincena 1-2/adelanto con monto precargado, dominio puro `nomina.ts`), RPC `register_expense_atomic` (`20260704_003`) que crea el egreso de caja (`cash_movements` tipo `expense`) en la misma transacción cuando el gasto se paga con efectivo de caja abierta | `(sin commit aún)` |
| PLAN-49 | ✅ Hecho — comparativa mensual (últimos 6 meses, dominio puro `monthly-comparison.ts`), plantillas recurrentes ("Gastos del mes": crear/eliminar plantillas, "Registrar" abre el form prellenado y marca "Registrado este mes" vía `recurrentes.ts`), y export Excel de `/finanzas` con hojas Resumen/Gastos/Comparativa (`expense-export.ts`; se decidió exportar desde el propio módulo en vez de tocar el Excel de `/reportes` — ADR 0011). Probado end-to-end en Chrome contra producción el 2026-07-05 | `(sin commit aún)` |

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

### Bloque activo — Programa de fidelización MOVE ON Club (planeado 2026-07-14, núcleo implementado 2026-07-14)

Diseño en `docs/adr/0013-programa-fidelizacion-move-on-club.md` y `docs/modules/loyalty.md`;
sesiones: `docs/sessions/2026-07-14-plan-fidelizacion-move-on-club.md` (planeación) y
`docs/sessions/2026-07-14-implementacion-move-on-club.md` (implementación). El dueño decidió
adelantarlo el 2026-07-14, con un cambio sobre el plan: **búsqueda de cliente flexible por
celular O por documento** (no solo celular). Migraciones `20260714_001..003` aplicadas al
remoto y verificadas con batería E2E SQL (T1-T9 funcional, S1-S5 seguridad, A1-A4 ajuste
manual, todo con rollback — ver sesión de implementación §5). La batería atrapó y corrigió un
bug real: el check de desglose de descuentos no conocía el componente de canje (`20260714_003`).

| ID | Título | Prioridad | Criterio de cierre |
|---|---|---|---|
| PLAN-50 | ✅ Hecho — Migración DB: identidad de cliente + esquema de fidelización | P0 | `20260714_001_loyalty_move_on_club.sql` aplicada al remoto: columnas en `clientes`/`productos`/`sales`/`sale_items`, tablas loyalty con RLS solo-lectura, RPCs internas con execute revocado |
| PLAN-51 | ✅ Hecho — Dominio puro de fidelización + tests unitarios | P0 | `PhoneCO` (18 tests) + `stamps.ts` (20 tests): sellos elegibles, ciclos de recompensa, vigencia, descuento de canje, ajuste de línea |
| PLAN-52 | ✅ Hecho — Sellos integrados a `create_sale_atomic` | P0 | `loyalty_apply_delta` + `loyalty_generate_rewards` en la misma transacción de la venta; idempotente (índice único earn por sale); smoke test remoto reproduce el ejemplo oficial (7+3 → 1 recompensa, quedan 2). pgTAP pendiente (bloqueado por PLAN-46) |
| PLAN-53 | ✅ Hecho — Canje integrado a `create_sale_atomic` | P0 | `p_loyalty_redemptions` (default null, compatible); descuento dirigido en `sale_items.loyalty_discount_amount`, excluido del tope RN-S09; valida vigencia/estado/doble redención; extras se cobran aparte |
| PLAN-54 | ✅ Hecho — Registro rápido + búsqueda flexible en POS | P0 | Botón "+ Nuevo" en el picker abre `ClienteFormDialog` sin perder la venta; búsqueda por celular normalizado (acepta +57/espacios/guiones) O documento O nombre; celular único con mensaje claro |
| PLAN-55 | ✅ Hecho — UI de progreso y canje en POS | P0 | Bloque MOVE ON Club en el carrito: barra X/8, preview de sellos de la venta, botón "Canjear batido gratis" (aplica a la línea elegible más costosa, muestra diferencia), quitar canje |
| PLAN-56 | ✅ Hecho — Reversa de sellos al anular venta | P1 | `void_sale_atomic` extendido: restaura recompensas canjeadas en la venta anulada, anula recompensas generadas por ella (devuelve sellos), reversa sellos ganados truncando en 0 (RN-LF14) |
| PLAN-57 | ✅ Hecho (2026-07-16) — Historial completo de fidelización por cliente | P1 | Diálogo "Club" en `/clientes` (`cliente-loyalty.dialog.ts`): resumen (saldo, progreso X/N, recompensas vigentes) + ledger cronológico con etiquetas es-CO. Verificado E2E contra Supabase local |
| PLAN-58 | ✅ Hecho (2026-07-16) — Ajuste manual de sellos (admin) | P1 | Bloque admin-only en el mismo diálogo "Club": delta ≠ 0 + motivo ≥ 3 (schema Zod `adjust-stamps-form.factory.ts`), invoca `adjust_loyalty_stamps` y refresca. Verificado E2E local |
| PLAN-59 | ✅ Hecho (2026-07-16) — Configuración del programa en `/configuracion` | P2 | Sección "MOVE ON Club" (patrón factory/mapper/presenter + `LoyaltySettingsService` → `settings.data.fidelizacion`); `TiendaInfoService.fidelizacion` alimenta el POS (progreso X/N ya no usa el default hardcodeado) y el diálogo Club. Verificado E2E local (guardar 10 sellos → RPC y UI leen 10) |
| PLAN-60 | ✅ Hecho (2026-07-16) — Vencimiento explícito + reporte de fidelización | P2 | RPC `expire_loyalty_rewards` (migración `20260716000100`, invocado oportunistamente desde el diálogo Club y el reporte; **pendiente aplicar al remoto**) + tab "Fidelización" en `/reportes` (dominio puro `program-report.ts` con 6 tests, `LoyaltyReportService`, `loyalty-report.component.ts`). Verificado E2E local |

> **Acción del admin para activar el programa:** marcar los batidos participantes con el nuevo
> checkbox "Participa en MOVE ON Club" en el formulario de producto, y activar
> `autoriza_fidelizacion` al registrar clientes.

### Bloque activo — Clean Architecture feature-first (ADR 0015, decisión del dueño 2026-07-17)

Arquitectura objetivo, adaptación a Angular (DI con abstract classes, SOLID, catálogo de
patrones, fronteras por linter) en **`docs/adr/0015-feature-first-clean-architecture.md`** —
leerlo completo antes de tocar cualquier PLAN de este bloque. Este bloque **absorbe**
PLAN-30 (dividir pos.page), PLAN-31 (repos + Result), PLAN-34 (formularios 3 archivos) y
PLAN-35 (errores tipados): se cierran feature por feature dentro de PLAN-64..67, no como
tareas sueltas.

**Regla de ejecución:** cada PLAN termina con `pnpm typecheck && pnpm lint && pnpm test` en
verde + QA manual del flujo tocado contra Supabase LOCAL (regla del dueño: pruebas con datos
siempre en local) + commit propio en `dev`. Nunca dos PLANs mezclados en un commit.

| ID | Título | Prioridad | Criterio de cierre |
|---|---|---|---|
| PLAN-61 | ✅ Hecho — Fase mecánica: co-ubicación total + suite verde | P0 | 210 archivos movidos (`git mv`, historia preservada) según el mapa ADR 0015 §5; `src/modules/` y `tests/unit/modules/` eliminados; 1 import roto corregido (`@/../` no resuelto por el codemod), vitest.config.ts y script Siigo apuntando a rutas nuevas; typecheck + lint + 508 tests + `ng build` (resuelve los 40+ chunks lazy) en verde. Gap de cobertura preexistente detectado (`receipt-settings-form` sin tests, 86.24% global) — **no es regresión** (confirmado con `git stash`, ya fallaba en el commit previo); queda anotado para PLAN-66. Extensión de Chrome no disponible esta sesión → falta QA manual de clic-a-clic (pendiente, no bloqueante dado que `ng build` resuelve el grafo de imports de cada ruta) |
| PLAN-62 | ✅ Hecho — Contratos como abstract classes + composition root por feature | P0 | 8 contratos (`audit`, `cash-register`, `customers`, `expenses`, `inventory`, `loyalty`, `products`, `sales`) reescritos como `abstract class` desde el uso real; 4 estaban divergentes (`Result<T>` aspiracional) y 3 no existían. `data/` hace `extends`. 8 `<feature>.providers.ts` registrados en `app.config.ts` (root, no por ruta — ver ADR 0015 §6.2 revisado). Limpieza: 3 use-cases huérfanos + 3 tests eliminados (código muerto contra las interfaces viejas). Sin cambio de comportamiento (nada inyecta aún la abstracción). Verificado: typecheck+build+lint+495 tests |
| PLAN-63 | ✅ Hecho — Fronteras automáticas por linter | P0 | `eslint.config.js`: reglas `no-restricted-imports` por zona generadas por feature (domain: pureza + cero cross-feature; data: sin presentation + cero cross-feature; resto: cero cross-feature). Auditoría real reveló 5 excepciones legítimas de reuso de `presentation/` entre features (no solo la `pos → sales/domain` asumida en el ADR) — documentadas explícitamente con referencia a PLAN-68, no descartadas en silencio. Verificado con 2 pruebas deliberadas (import de Angular en domain/, import cross-feature de presentation/services) que confirmaron el bloqueo con el mensaje correcto, luego revertidas. Bug encontrado y corregido en el camino: bloques de config que matchean el mismo archivo NO fusionan `no-restricted-imports`, el último gana — se consolidó en un bloque por zona |
| PLAN-64 | ✅ Hecho — Cableado hexagonal: pilotos `products` + `customers` | P1 | 11 use-cases nuevos (3 customers + 8 products) validan con Zod y devuelven `Result` en escrituras con forma; `deactivate*`/`delete*`/`save-components` son seams delgados sin validación. `cliente-form.dialog.ts` migrado de `Validators` planos al patrón de 3 archivos (violaba el estándar). Los 9 consumidores de presentation (incl. 2 cross-feature: `inventario.page.ts`, `reports.service.ts`) inyectan ahora las abstracciones `CustomerRepository`/`ProductRepository`. `CABLED_FEATURES` del linter incluye ambas — nadie puede ya inyectar `CustomersRepository`/`ProductsRepository` concretas. 1 excepción nueva documentada (`product-image-field.component.ts` → datasource de Storage). Limpieza: `createCategoriaSchema` duplicado/no usado eliminado de `product.dto.ts`. Verificado: typecheck+build+lint+511 tests |
| PLAN-65 | ✅ Hecho — Cableado hexagonal: `sales`(+`pos`) + `inventory` + `cash-register` | P1 | 10 use-cases nuevos (5 cash-register + 3 inventory + 2 sales), todos con DTO Zod ya existente desde PLAN-61: `openCashSession`/`addCashMovement`/`voidCashMovement`/`closeCashSession`/`correctCashSessionOpening`, `registerEntry`/`adjustStock`/`transferStock`, `voidSale`/`correctPayment` — todos validan con `schema.safeParse` y devuelven `Result` (ningún seam delgado: los 3 contratos tenían DTO de borde para cada escritura). `closeCashSession` reempaqueta el DTO plano (`actualCashAmount`/`actualCardAmount`/`actualTransferAmount`/`actualOtherAmount`) en el array `actualPayments` que espera el repositorio — verificado contra `close_cash_session_atomic` que un método ausente y un método en 0 son equivalentes (agrupación por `metodo`), así que no cambia el resultado del cierre. 16 archivos de presentation cableados (incl. cross-feature: `productos.page.ts`, `pos-data.service.ts`, `receipt-print.service.ts`, `reports.service.ts`) inyectan ahora `CashRegisterRepository`/`InventoryRepository`/`SaleRepository` (abstracciones) en vez de las clases concretas Supabase; nota: `SaleRepository` (dominio) vs `SalesRepository` (impl. Supabase) tienen nombres distintos, a diferencia de `CashRegisterRepository`/`InventoryRepository` que coinciden entre capas. `CABLED_FEATURES` del linter pasa a `['customers', 'products', 'sales', 'inventory', 'cash-register']` — cero excepciones nuevas necesarias en `PRESENTATION_BOUNDARY_EXCEPTIONS` (auditoría de consumidores no encontró más reuso indebido de `presentation/` entre features). Pendiente explícito: dividir `pos.page.ts` (~1500 líneas) en componentes < 300 líneas se pospone a una sesión con QA manual en navegador disponible — solo se cablearon sus puntos de inyección (ninguno directo a estos 3 repos: usa `PosDataService`/`PosSaleService`/`ReceiptPrintService` que ya encapsulaban el acceso). El "flujo de venta E2E manual en local" del criterio original también queda pendiente por la misma razón. `SaleReader` segregado (ISP) no se creó: `reports.service.ts` solo consume 3 métodos de lectura del contrato ya delgado (`listByDate`, `listSessionsByDateRange`, `getStockLevels`) — no hay métodos de escritura mezclados que justifiquen la segregación. Verificado: typecheck+build+lint+531 tests |
| PLAN-66 | Cableado hexagonal: `expenses` + `loyalty` + `reports` + `settings` | P2 | Mismo criterio; `reports` consume contratos de lectura segregados, no repos de escritura; `loyalty` ya tiene dominio puro completo — solo formaliza contrato del repo y providers |
| PLAN-67 | Cableado hexagonal: `auth` + `audit` + limpieza de excepciones del linter | P2 | Últimas features cableadas; se retiran TODAS las excepciones temporales de PLAN-63: la regla `presentation no importa data` queda activa globalmente sin excepciones |
| PLAN-68 | Limpieza profunda + documentación final | P2 | Cero código muerto (knip o revisión manual de exports sin uso); nombres consistentes (`*.usecase.ts`, `*.repository.ts`, `*.datasource.ts`, `*.model.ts`); `CLAUDE.md`, `docs/02-architecture.md`, `docs/standards/ui-components.md` y `forms.md` reescritos contra ADR 0015 (una sola fuente de verdad, sin referencias a `src/modules` ni al híbrido); ADR 0014 marcado parcialmente superseded; ADR 0015 → Aceptado |
| PLAN-69 | Verificación integral y merge a main | P1 | Suite completa + coverage ≥ 90% dominio; QA manual E2E en local de los 8 flujos núcleo (login, venta, pago mixto, descuento, canje Club, anulación, cierre de caja, reportes); `pnpm build` de producción; merge `dev` → `main` con el dueño |

**Orden:** 61 → 62 → 63 (la base y el enforcement primero) → 64 → 65 → 66 → 67 → 68 → 69.
PLAN-62 y 63 son deliberadamente ANTES del cableado: primero existe el contrato y el linter
que lo protege, después se cablea feature por feature sin poder regresar al atajo.

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
