# Spec de Sesión — 2026-10-24 — App iOS del dueño: planeación, PLAN-75 y PLAN-76

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Planeación (bloque ADR 0021) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna (planeación) |
| Estado | Completada — ADR 0021 aprobado; PLAN-75 y PLAN-76 hechos (sin commit) |

---

## 1. Objetivo de la sesión

Revisar todo el contexto de MOVE ON POS para decidir cómo construir una app móvil en Swift, y redactar el ADR y el plan. El dueño definió que la v1 es **para él como dueño**: dashboard de ventas, caja, stock y finanzas desde el iPhone.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/adr/0021-app-ios-dueno-swift.md` — decisión de app iOS nativa (SwiftUI, solo admin, solo lectura en v1).
- `docs/sessions/2026-10-24-plan-app-ios-dueno.md` — este spec.

### 2.2 Archivos modificados
- `docs/plan-de-trabajo.md` — nuevo bloque "App iOS del dueño" con PLAN-75..84.

Sin cambios de código ni de base de datos.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| v1 solo lectura | Incluir registrar gastos/ajustes | Evita duplicar validaciones Zod en Swift desde el día uno |
| Agregados en RPC SQL `owner_*` con test de paridad | Portar a Swift las reducciones TS de `/reportes` | `getDailyReport` y `buildFinancialSummary` calculan en el cliente; portarlos daría cifras distintas entre iPhone y web |
| `apps/ios-owner/` en el monorepo | Repo aparte | Misma fuente de verdad en `/docs` y migraciones al lado |
| Solo dependencia `supabase-swift` | Librerías de gráficas/DI | Swift Charts y Observation vienen con iOS |
| No se actualizó todavía `01-mvp-scope.md` ni ADR 0004 | Editarlos ya | El ADR está Propuesto; se actualizan en PLAN-75 al aprobarse |

---

## 4. ADRs creados o actualizados

- `docs/adr/0021-app-ios-dueno-swift.md` — app iOS nativa del dueño; modifica ADR 0004 al aceptarse.

---

## 5. Tests

No aplica (solo documentación).

---

## 6. Bloqueos y preguntas pendientes

- [ ] ¿Se crea la cuenta Apple Developer (99 USD/año) para TestFlight, o se empieza con firma personal (expira cada 7 días)?
- [ ] Hallazgo previo sin resolver: la migración `20260814000100` (`correct_inventory_entry_cost_atomic`) no está aplicada al remoto (ver spec `2026-10-24-integrar-trabajo-pendiente-dev.md`). No bloquea la app iOS.

---

## 7. Próximos pasos

1. PLAN-77: login + gate de rol admin + Face ID (reemplaza `HomePlaceholderView`).
2. PLAN-78: RPC `owner_sales_summary` con test de paridad contra `getDailyReport` (Supabase local).
3. PLAN-79: dashboard "Hoy".

---

## 9. Continuación — PLAN-75 y PLAN-76 (mismo día)

El dueño aprobó el ADR 0021.

**PLAN-75:** ADR 0021 → Aceptado; ADR 0004 con estado "modificado por ADR 0021" y sección de modificación; fila de app móvil en `01-mvp-scope.md` reescrita como excepción fuera del MVP; creado `docs/modules/ios-owner.md`. La cuenta Apple Developer sigue sin decidir (solo hace falta en PLAN-84).

**PLAN-76:** creado `apps/ios-owner/`:
- `project.yml` (XcodeGen; el `.xcodeproj` se genera y no se versiona — evita conflictos de `project.pbxproj`). iOS 17+, Swift 6, concurrencia estricta, solo iPhone vertical, bundle `co.moveon.owner`.
- `Packages/MoveOnKit`: target `Domain` sin dependencias (`CurrencyFormatter`, `StoreCalendar` espejo de `day-range.ts`) y `Data` con `supabase-swift` 2.55.4 (`SupabaseSettings`, `SupabaseClientFactory`). La frontera la impone `Package.swift`.
- App: `AppConfig` (lee URL/anon key del Info.plist ← `Config/App.xcconfig`), `AppContainer` (composition root), `Theme` (negro + #F9D128), `ConfigErrorView`, `HomePlaceholderView`.
- `Config/App.xcconfig` versionado apunta a Supabase LOCAL con la anon key demo pública; `Local.xcconfig` (ignorado) para producción.
- `scripts/ios-test.sh`: tests del paquete + `xcodegen generate` + `xcodebuild test`.

**Verificación:** `scripts/ios-test.sh` → 11 tests de MoveOnKit y 4 de la app en verde (`TEST SUCCEEDED`); la app abre en el simulador mostrando la pantalla temporal con "Supabase local". No se tocó código Angular ni SQL, así que no se corrió `pnpm`.

**Aviso:** durante la sesión aparecieron cambios ajenos sin confirmar en el workspace (`cash-register.repository.ts`, migración `20261024000200_lock_direct_writes_sales_cash_audit.sql`, `supabase/tests/lock-direct-writes.test.sql`, spec `2026-10-24-auditoria-arquitectura-solid.md`). No son de esta sesión y no se tocaron.

## 10. Continuación — repo propio para la app

El dueño pidió que la app viva en un repo nuevo. Se movió `apps/ios-owner/` a `/Users/ander/Documents/moveonapp-pos-planeacion/moveon-owner-ios` (git nuevo, rama `main`), con `README.md`, `CLAUDE.md` (apunta a `/docs` de este repo), `AGENTS.md` y `scripts/test.sh` (antes `scripts/ios-test.sh` aquí, borrado). Se agregó ADR 0021 §7 (enmienda) y se actualizaron el módulo y la fila PLAN-76. Docs, plan, specs y RPC `owner_*` siguen en este repo. La decisión de la tabla §3 "`apps/ios-owner/` en el monorepo" queda reemplazada por esta.

## 11. Continuación — PLAN-77 (login, gate de rol, Face ID)

Hecho en `moveon-owner-ios` (commit `8173761`): dominio de sesión y política de acceso, repositorio Supabase con mapeo de errores igual al web, login, recuperación de contraseña (enlace a `/restablecer-contrasena` del POS web, nueva clave `PASSWORD_RESET_URL` en `App.xcconfig`), bloqueo con Face ID/código. Detalle en `docs/modules/ios-owner.md` §Autenticación.

**Tests:** paquete 33 en verde; app 15 en verde (`AppSession`: restaurar, bloquear/desbloquear, admin, cajero denegado con cierre de sesión, validación sin red, recuperación genérica).

**QA en simulador contra Supabase local:** `cajero@moveon.local` → "Acceso solo para el dueño…"; `admin@moveon.local` → entra; reabrir la app restaura la sesión y pide desbloqueo con el código del iPhone (el simulador no tiene Face ID enrolado, así que no se probó la cara; sí el flujo de bloqueo). No se probó el envío real del correo de recuperación (requiere SMTP local/Inbucket, que estaba detenido).

**Ajuste a pedido del dueño ("con contraseña o Face ID es más que suficiente"):** se quitó el bloqueo en segundo plano y el respaldo con el código del iPhone. Con sesión guardada: Face ID o "Entrar con contraseña"; sin Face ID en el teléfono, login con contraseña. Verificado en simulador: sin Face ID enrolado → login; con Face ID enrolado → aviso de Face ID y entrada al simular coincidencia. 16 tests de la app en verde (repo iOS, commit siguiente a `8173761`).

**Datos de prueba creados (solo local):** usuario `cajero@moveon.local` con fila `user_tiendas` rol `cajero` en la tienda demo.

## 12. Continuación — reglas de `gym_ios`

El dueño pidió que las reglas del proyecto sean iguales a las de `gym_ios` (`~/Desktop/gym_ios`). Hecho en `moveon-owner-ios` (commit `1a8ee5b`):

- `docs/ENGINEERING_RULES.md`: §1–11 copiadas de `gym_ios` (solo cambian nombres, rutas y ejemplos); §12 con las decisiones de esta app (backend y spec en el POS, solo lectura, un solo target, modo oscuro de marca, Face ID o contraseña, recuperación por el web, textos del web, tests de UI pendientes para PLAN-79). `CLAUDE.md` con el mismo formato; se quitó `AGENTS.md` (gym_ios no lo tiene).
- Reestructura a un solo target (`App/Core/Data/Features`), sin `MoveOnKit`. Se eliminaron `CurrencyFormatter` y `StoreCalendar` (sin uso aún; YAGNI): vuelven en PLAN-79 a `Core/Formatting` y `Core/Dates`.
- `AppError` + `UserMessages`, `SupabaseErrorMapper`, `AppLogger`, `Validators`, tokens `AppColors/AppFont/AppMetrics`, componentes (`BrandMark`, `PrimaryButton`, `LinkButton`, `AppTextField`, `ErrorBox`, `ModelHost` copiado de gym_ios).
- Secretos: `Config/Secrets.xcconfig` (fuera de git) con `scripts/make_secrets.sh` (Supabase local por defecto). Se quitó `scripts/test.sh`.
- ADR 0021 §8 y `docs/modules/ios-owner.md` actualizados.

**Tests:** 50 en verde (Swift Testing, nombres en español), sin avisos del compilador en archivos propios. **Simulador** (contra Supabase local): Face ID con la sesión guardada → entra; cerrar sesión → login; login legible con texto grande (accessibility-medium). El rechazo del cajero quedó cubierto por tests; contra el backend real se había verificado antes de la reestructura con la misma consulta.

**Pendiente:** tests de UI y modo demo (`-demo`) con PLAN-79; VoiceOver no se revisó.

## 13. Continuación — push del repo iOS y PLAN-78

- `moveon-owner-ios`: `main` subido a GitHub (`1a8ee5b`).
- **PLAN-78 (POS):**
  - `reports/domain/services/sales-summary.ts`: `buildSalesSummary(sales, timezone)` con la parte pura de `getDailyReport`. `reports.repository.ts` la usa sin cambiar su salida. 6 tests unitarios nuevos.
  - Migración `20261024120000_owner_sales_summary.sql`: RPC de solo lectura, solo admin, con rango en la zona de la tienda (contrato en `docs/modules/ios-owner.md`).
  - Paridad: `pnpm test:parity` → 10 tests en verde contra el Supabase local; deja la base como estaba.
- **Verificación:** `pnpm test` 786 en verde; `pnpm lint` en verde; `tsc --noEmit` y `ng build --configuration development` sin errores. El typecheck se corrió sin el hook `pretypecheck` para no reapuntar `runtime-config.json` a producción: había un servidor de desarrollo de otra sesión usando esta carpeta.
- **Base local:** estaba atrasada; `supabase migration up --local --include-all` aplicó hasta `20261024000200`. Se detuvo en `20261024000300_lock_direct_writes…` (de otra sesión) porque sus políticas ya estaban aplicadas a mano en local sin registro; no se tocó. `20261024000400/500` siguen sin registrar en local. La RPC nueva se aplicó con psql y se registró en `schema_migrations`.
- **Remoto:** `owner_sales_summary` NO está aplicada en producción; pendiente de confirmación del dueño.

## 14. Continuación — PLAN-79 (dashboard "Hoy")

Hecho en `moveon-owner-ios` (commit `e125945`, sin push). Detalle en `docs/modules/ios-owner.md` §Dashboard y decisiones en `ENGINEERING_RULES.md` §12 del repo iOS.

- **Tests:** 81 unitarios + 6 de UI (modo demo) en verde, sin avisos propios. Hallazgo al escribir los de UI: el aviso del sistema "¿Guardar contraseña?" tapa la app tras el login; lo dibuja `com.apple.SafariViewService` y los tests lo descartan.
- **Cambio de diseño durante la sesión:** el selector de período pasó de un menú escondido a un control segmentado visible (más a mano para el dueño).
- **QA real:** se cargaron en el Supabase LOCAL 4 ventas de hoy en la tienda demo (`IOS-QA-1..4`, ids `e1000000-…`), con pago mixto y una línea sin costo. La app mostró $ 645.000 / 5 ventas / utilidad $ 270.000 / ticket $ 129.000, idéntico a `owner_sales_summary` consultada con psql. Se encontró y corrigió que una caja abierta desde otro día (la local está abierta desde el 15 sep) se mostraba como si fuera de hoy.
- **Pendiente:** push del repo iOS; `owner_sales_summary` sigue solo en local.

## 15. Continuación — PLAN-80 (ventas)

- `moveon-owner-ios`: `main` con PLAN-79 subido (`e125945`); PLAN-80 en commit local, sin push.
- Pestañas Resumen/Ventas, lista paginada, búsqueda por número en todas las fechas y detalle de venta. Piezas compartidas movidas a `Core` y `Domain/Sales` (decisiones en `ENGINEERING_RULES.md` §12 del repo iOS).
- **Tests:** 98 unitarios + 8 de UI en verde, sin avisos.
- **QA real (Supabase local):** se anuló `IOS-QA-2` con psql (solo local) para ver el caso de venta anulada. La lista de hoy coincidió con `sales` (6 filas). El detalle de `IOS-QA-3` muestra el pago mixto, y el de `IOS-QA-2` el motivo de anulación. La búsqueda "qa-2" la encontró en todas las fechas.
- **Ojo:** la otra sesión está creando ventas de prueba (`V-000001`, `V-000002`) en el mismo Supabase local mientras trabaja; por eso el total de hoy pasó de $ 645.000 a $ 700.000 entre pruebas.

## 16. Continuación — PLAN-81 (caja)

- `moveon-owner-ios`: `main` con PLAN-80 subido (`04fdf5a`); PLAN-81 en commit local, sin push.
- POS (commit `5da148e`): migración `20261024130000_owner_cash_session_summary.sql` (solo local) y paridad (7 tests). Las paridades comparten `tests/integration/support/local-stack.ts` y corren en serie (`fileParallelism: false`); `pnpm test:parity` → 17 en verde.
- iOS: pestaña Caja con turno actual (esperado y desglose, ventas por método, movimientos) e historial de cierres con detalle. 112 unitarios + 10 de UI en verde.
- **Desviación del plan:** el historial no usa `list_cash_history_days` sino los cierres guardados en `cash_sessions`, porque esa RPC agrupa por día y no trae esperado vs. contado.
- **Hallazgo con datos reales:** la diferencia guardada es esperado − contado (positivo = faltan). La primera versión decía "Faltan" donde sobraba; corregido y cubierto con un test con el caso real (esperado 380.000, contado 382.000, `difference` −2.000).

## 17. Continuación — PLAN-82 (stock)

- `moveon-owner-ios`: `main` con PLAN-81 subido (`41eaf71`); PLAN-82 en commit local, sin push.
- Pestaña Stock con filtros, búsqueda y kardex; la regla y la lectura de stock pasan a `Domain/Inventory` y `Data/Inventory`, compartidas con el dashboard. 121 unitarios + 12 de UI en verde.
- QA real: niveles y kardex de Creatina idénticos a la base. Nota: las ventas `IOS-QA-*` se cargaron directo con psql y no generaron salidas de inventario (no pasaron por `create_sale_atomic`); las `V-00000x` de la otra sesión sí aparecen en el kardex.
- Sin cambios en el POS para este PLAN (solo lectura de tablas y RPC existentes).

## 18. Continuación — PLAN-83 (finanzas)

- `moveon-owner-ios`: `main` con PLAN-82 subido (`18443d6`); PLAN-83 en commit local `0bfb29a`, sin push.
- POS (commit `f69d073`): migración `20261024140000_owner_finance_summary.sql` (solo local) y paridad (4 tests); `pnpm test:parity` → 21 en verde.
- iOS: pestaña Finanzas (mes navegable, resultado, entradas por método, gastos por categoría, fondo, tendencia de 6 meses). 130 unitarios + 13 de UI en verde.
- QA real (octubre, Supabase local): cifras de la app idénticas a la RPC. Datos de QA creados: categorías `ios-qa-arriendo` / `ios-qa-servicios`, gastos "IOS-QA" de $ 150.000 y $ 45.000 y fondo con saldo inicial $ 300.000 desde 2026-09-01 en la tienda local.
- Pendiente para PLAN-84: aplicar en remoto `owner_sales_summary`, `owner_cash_session_summary` y `owner_finance_summary` con confirmación del dueño.

## 19. Continuación — PLAN-84 (marca) y giro a escrituras (ADR 0022)

- `moveon-owner-ios`: `main` con PLAN-83 subido (`0bfb29a`).
- **Marca:** asset catalog con `AppIcon` (logo oficial `moveon-logo-brand.png` sobre negro, 1024 px, misma composición que `moveon-icon.png` del catálogo), `BrandLogo` y `LaunchBackground`; pantalla de arranque con el logo sobre negro; el login y el desbloqueo con Face ID muestran el logo oficial en vez del texto. Nombre bajo el ícono: "MOVE ON" ("MOVE ON Dueño" se cortaba).
- **Pedido del dueño a mitad de PLAN-84:** "Que diga Admin no dueño y también debe ser funcional para gestión de inventario y ventas".
  - Todos los textos visibles pasan de "Dueño" a "Admin" (los identificadores de código no cambian).
  - Respuestas del dueño: registrar y anular ventas; entradas, ajustes, traslados y crear/editar productos; las escrituras van antes de publicar.
- **Hallazgo:** todas esas escrituras ya existen como RPC `*_atomic`, y `create_sale_atomic` recalcula precios, descuentos, IVA y número de venta en el servidor (ignora los totales del cliente). Editar un producto es un `update` directo sobre `productos`, como en el web.
- **ADR 0022 propuesto** (`docs/adr/0022-app-ios-admin-escrituras.md`) y **PLAN-85..91** agregados. PLAN-84 (QA final, migraciones remotas y TestFlight) queda para después de PLAN-91.
- **Pendiente:** aprobación del ADR 0022 por el dueño antes de escribir código de escrituras. Montserrat no está en el repo (el web la carga de Google Fonts); incluirla en la app requiere descargar los TTF (licencia OFL), así que se pregunta al dueño.

## 20. Continuación — ADR 0022 aprobado, PLAN-85 y PLAN-86

- El dueño aprobó el ADR 0022 ("Apruebo el ADR 0022…"). Estado → Aceptado; ADR 0021 anota "Modificado por ADR 0022". `moveon-owner-ios` `main` con la marca subido (`895998a`).
- **PLAN-85 (POS):**
  - `tests/integration/fixtures/ios-payloads/` con `README.md` (formato `kind`/`target`/`payload` y marcadores `{{id}}`), `register_inventory_entry.json` (lo usará PLAN-87) y `audit_log_adjust.json`.
  - `tests/integration/support/ios-payloads.ts` y `tests/integration/ios-payloads.contract.test.ts`: envía cada fixture al Supabase local y verifica el efecto (movimiento `entry` en bodega y stock 12; la fila de auditoría pasa la política `audit_logs_insert_own`). Falla si hay un fixture sin caso. `pnpm test:parity` → 24 en verde.
  - `docs/modules/ios-owner.md` pasa a "MOVE ON Admin" con la sección Escrituras.
- **PLAN-86 (iOS):**
  - Piezas nuevas: `AppError.offline` y `.rejected(RejectionReason)`, `ServerRejectionMapper` (mensajes reales de las RPC sacados de la base local), textos en `UserMessages`, `Domain/Audit` (`AuditEvent`, `AuditActor`, `AuditValue`, `AuditLogging`), `Data/Audit` (`AuditLogRowDTO`, `SupabaseAuditLogger`), `Core/Connectivity` (`NWPathMonitor`), `Core/Forms/Submission` y `Core/Components/ConfirmationSheet` (con vistas previas).
  - `AppDependencies` incluye `audit`, `connectivity` y `makeSubmission()`. El modo demo agrega el escenario `offline`.
  - Contrato del lado Swift: `scripts/sync_payload_fixtures.sh` copia los fixtures a `MoveOnOwnerTests/Fixtures/Payloads`, y `AuditLogRowDTOTests` compara el JSON (con el encoder de PostgREST) contra `audit_log_adjust.json`.
  - 142 tests unitarios en verde.
- **Verificación contra el Supabase local:** `adjust_stock_atomic` con delta 0 y `transfer_stock_atomic` con el mismo origen y destino devuelven `P0001` con "El ajuste no puede ser cero" y "El origen y destino del traslado deben ser diferentes", que el mapeo reconoce; no se escribió nada. La app real arranca y carga con normalidad.
- **Hallazgo:** el web solo audita desde el cliente algunos cambios. Por ejemplo, la entrada de mercancía no se audita y el ajuste y el traslado sí. La app replica exactamente esos eventos, ni más ni menos.
- Aún no hay pantalla que escriba: `ConfirmationSheet` y `Submission` se verán en uso con PLAN-87 (entrada de mercancía).

## 21. Continuación — PLAN-87 (entrada de mercancía)

- `moveon-owner-ios`: `main` con PLAN-86 subido (`01fd762`).
- **iOS:**
  - `Features/Stock/Domain`: `InventoryEntry`, `InventoryWriting` y `RegisterInventoryEntryUseCase`. El caso de uso revalida: producto con stock propio, cantidad > 0, costo > 0 o nulo, motivo de 1 a 200 caracteres o nulo.
  - `Features/Stock/Data`: `RegisterInventoryEntryParams`, con `null` explícitos y comparado contra el fixture `register_inventory_entry.json`, y `SupabaseInventoryWriter`.
  - `Features/Stock/Presentation`: `InventoryEntryFormViewModel`, `InventoryEntrySheet` y el `NoticeBox` (Core) que hace las veces del toast del web.
  - `InventoryLocation` pasa a `Domain/Inventory`; `ProductStock` lleva `cost`; `Core/Forms/NumberInput` y validadores nuevos.
  - Pasan los tests unitarios (incluidos los de la entrada, el contrato y `NumberInput`) y los 15 de interfaz (2 nuevos: entrada con costo y sin conexión).
- **QA contra el Supabase local** (QA Creatina 300g; antes: costo 45.000, punto de venta 6, bodega 0, invertido en octubre 1.150.000):
  - Desde la lista, deslizando, se guardó por accidente una entrada de 1 unidad a 45.000 (los valores precargados). Las capturas del simulador iban un paso atrasadas y un toque cayó en el botón. Es una entrada real en los datos locales de prueba, coherente con lo enviado.
  - Desde el detalle se registraron 10 unidades a bodega a 47.000 con motivo "QA iOS entrada". La base muestra `entry` / `bodega` / 10 / 47000 / "QA iOS entrada", el costo del producto pasa a 47.000 y la bodega a 11.
  - `owner_finance_summary` da invertido del mes 1.665.000 (1.150.000 + 45.000 + 470.000), igual que la pestaña Finanzas.
  - La app mostró "Entrada registrada y costo de QA Creatina 300g actualizado" y recargó el stock y el kardex.
- Sin cambios en el POS para este PLAN, aparte de los docs: el fixture y el test de contrato son de PLAN-85.

## 22. Continuación — PLAN-88 (ajustes y traslados)

- `moveon-owner-ios`: `main` con PLAN-87 subido (`e6c5e49`).
- **POS** (`cca4637`): fixtures `adjust_stock.json`, `transfer_stock.json` y `audit_log_transfer.json`, con sus casos de contrato (un producto con 20 en bodega queda en 18 tras ajustar −2; el traslado de 4 mueve el stock y devuelve el id). `pnpm test:parity` → 27 en verde.
- **iOS:**
  - Dominio: `InventoryAdjustment`, `InventoryTransfer`, `AdjustStockUseCase` y `TransferStockUseCase` (validan, llaman a la RPC y auditan; si la RPC falla no se audita).
  - Datos: `AdjustStockParams`, `TransferStockParams` y `SupabaseInventoryWriter` (el ajuste devuelve la fila y se toma su id).
  - Presentación: `StockAdjustmentFormViewModel`/`Sheet`, `StockTransferFormViewModel`/`Sheet`, `StockWrite` + `StockWriteSheet` (enrutado común de las tres escrituras) y el marco `StockFormChrome`. `SecondaryButton` y `Validators.requiredText` van en Core.
  - Pasan 173 tests unitarios (con la auditoría comparada contra los contratos) y 17 de interfaz (2 nuevos: ajuste negativo con confirmación y traslado).
- **QA contra el Supabase local** (QA Creatina 300g, antes: punto de venta 6, bodega 11):
  - **Traslado:** pedir 20 muestra "Stock insuficiente en origen. Disponible: 11" y "Describe el motivo del traslado". Con 5 y "QA iOS traslado" quedan `transfer_out` −5 en bodega y `transfer_in` +5 en punto de venta, con 11 / 6.
  - **Ajuste −1 en bodega:** "QA iOS: corrige entrada duplicada" compensa la entrada accidental de PLAN-87. La confirmación aparece antes de guardar (0 ajustes en la base hasta confirmar) y luego queda `adjustment` −1, con 11 / 5.
  - **Auditoría:** `audit_logs` tiene las dos filas del cliente (`transfer` y `adjust`) con `admin@moveon.local`, la etiqueta "QA Creatina 300g" y los `changes` del web, más la fila `inventory.adjusted` del trigger del servidor.

## 23. Continuación — PLAN-89 (crear y editar productos)

- `moveon-owner-ios`: `main` con PLAN-88 subido (`e91d772`).
- **Regresión encontrada en el POS, también en producción:**
  - La migración `20261024000500` (de la sesión de auditoría, aplicada hoy en producción) quitó a `authenticated` el INSERT sobre `inventory_movements` porque daba por hecho que el stock inicial pasaba por una RPC `SECURITY DEFINER`.
  - Pero `create_product_with_initial_stock` era `SECURITY INVOKER`: crear un producto con stock inicial > 0 falla con "permission denied for table inventory_movements", **también en el POS web**. Es la única función afectada; las demás que insertan movimientos son DEFINER.
  - Lo detectó el contrato `create_product.json`.
  - Corrección: `20261024150000_create_product_initial_stock_definer.sql`, que la pasa a DEFINER (la función ya valida sesión, admin de la tienda, categoría y proveedor) y quita EXECUTE a `public` y `anon`. Commit `6fb3e7c`. **Aplicada solo en local**; en producción, pendiente de confirmación del dueño.
- **POS** (`b1e6035`): fixtures `create_product.json`, `update_product.json` (nuevo tipo `update` con `match`), `audit_log_product_create.json` y `audit_log_product_update.json`, con sus casos. Se verifican el SKU único (`23505` con el índice en el mensaje) y que el trigger de precio audite el cambio. `pnpm test:parity` → 31 en verde.
- **iOS:**
  - Feature `Products`: `ProductValues`, `NewProduct`, `ProductRecord`, `ProductPatch`, `ProductCatalog`, casos de uso, DTOs, `SupabaseProductCatalog`, `ProductFormViewModel` y `ProductFormSheet`.
  - Stock la abre con un `ProductFormPresenter` que arma el Shell. `ProductFormRequest` va en `Domain/Products`; `AuditValue.bool`, `RejectionReason.duplicateSku`/`duplicateBarcode`, `keyboardDoneButton()` y `LabeledSegments` van en Core.
  - Se corrige un aviso de concurrencia preexistente en `PeriodPicker`.
  - Pasan 186 tests unitarios y 19 de interfaz.
  - El test de interfaz mostró que el teclado numérico (sin tecla de cierre) tapaba "Crear producto"; de ahí el botón "Listo".
- **QA contra el Supabase local** (categoría de prueba "QA iOS Barras" creada):
  - **Crear:** "QA iOS Barra proteica" con SKU escrito "qa-barra" (se guarda "QA-BARRA"), código de barras, categoría, precio 8.000, costo 4.500, mínimo 3 y 12 en bodega → "Producto creado con 12 unidades en inventario". En el kardex aparece "Inventario inicial al crear producto"; el producto sale "Agotado" porque el punto de venta está en 0, que es la regla del web.
  - **Editar:** vaciar el código de barras, precio 8.500 y mínimo 4 → la base queda con `codigo_barras` null, 8500 y 4; la auditoría `update` lleva solo `{precioVenta, stockMinimo, codigoBarras: null}`, más la fila `product.price_changed` del trigger.
  - **SKU repetido:** "QA-CREA" → "Ya existe un producto con ese SKU." y no se crea nada.
- El test de interfaz de Caja falló una vez por tiempos y pasa al repetirlo; queda anotado como intermitente.
- **Producción (`20261024150000`):** el dueño pidió aplicarla y verificarla. Ya estaba aplicada y registrada por la sesión de auditoría (con autorización del dueño, ver su spec §22), así que no se volvió a ejecutar. Estado leído en remoto: `prosecdef = true`, EXECUTE solo para `authenticated`/`postgres`/`service_role` y `authenticated` sin INSERT directo en `inventory_movements` (el bloqueo de 000500 intacto).
- **Verificación funcional en producción sin dejar datos:** un bloque `DO` actúa como un admin real (`set local role authenticated` + `request.jwt.claims`), llama a `create_product_with_initial_stock` con 3 unidades en bodega y termina siempre con una excepción, que revierte todo. Resultado: "VERIFICACION_OK … movimientos_entry=1 bodega=3.000". Comprobado después: 0 productos y 0 movimientos con ese id o nombre.
- **Typecheck:** `tests/integration/ios-payloads.contract.test.ts` tipa el error de `send` (`code`/`message`); `tsc --noEmit` vuelve a 0 errores (lo había señalado la sesión de auditoría). No se corrió `pnpm typecheck` completo porque su hook reapunta `runtime-config.json` a producción.

## 24. Continuación — PLAN-90 (anular venta)

- `moveon-owner-ios`: `main` con PLAN-89 subido (`1f47d84`).
- **POS** (`837e402`): fixtures `void_sale.json` y `audit_log_void_sale.json`. El caso de contrato siembra una venta completada de 2 unidades y verifica que quede anulada con su motivo, que el stock del punto de venta suba 2 y que repetir dé "Venta no encontrada o ya anulada". La siembra fija `request.jwt.claim.sub` por el trigger `sales_enforce_cashier_identity`. `pnpm test:parity` → 33 en verde.
- **iOS:**
  - Piezas: `SaleVoiding`, `VoidSaleUseCase`, `VoidSaleParams`, `SupabaseSalesRepository.voidSale`, `VoidSaleFormViewModel` y `VoidSaleSheet`; el detalle tiene `voidableSale`, `didVoid` y el aviso.
  - `SecondaryButton(isDestructive:)` usa el rojo de error.
  - Pasan 193 tests unitarios y 20 de interfaz (nuevo: anular con motivo).
- **QA contra el Supabase local** (V-000002, 1 QA Creatina en efectivo; antes: punto de venta de Creatina 12 y el día en $1.265.000 / 7 ventas / 1 anulada):
  - Un motivo de 5 caracteres muestra "El motivo debe tener al menos 10 caracteres" y no envía nada.
  - Con "Error de cobro, QA iOS" la venta queda `voided` con su motivo y `voided_by` del admin. Hay movimiento `void_return` +1 en el punto de venta (13), el resumen del día queda en $1.180.000 / 6 ventas / 2 anuladas, y la auditoría registra `void` con `{reason}` y la etiqueta V-000002.
  - La app muestra el aviso y la tarjeta "Venta anulada"; la lista marca "Anulada" con el total tachado.
  - El efectivo esperado del turno abierto no cambió porque V-000002 no es de ese turno; el efecto en la caja lo cubre la regla del servidor, que excluye las ventas anuladas (paridad de PLAN-81).
  - Nota: V-000002 venía de los datos de prueba de la otra sesión (solo en local).

## 25. Continuación — PLAN-91 (registrar venta)

- `moveon-owner-ios`: `main` con PLAN-90 subido (`06629cb`).
- **Lectura de `create_sale_atomic`:**
  - **Lo que calcula el servidor:** ignora número y totales; recalcula precio, recargo de la opción (si no llega opción, aplica la de por defecto), IVA incluido y total.
  - **Pagos:** exige que cubran el total y que el cambio salga solo del efectivo; guarda los pagos netos de cambio.
  - **Inventario:** saca el stock de los productos con stock propio; un trigger consume los componentes de batidos y combos.
  - **Idempotencia:** devuelve la misma venta con la misma clave.
  - **Medios de pago:** el web solo ofrece efectivo y transferencia (`PAYMENT_METHOD_OPTIONS`), así que el iPhone no ofrece tarjeta aunque el plan la mencionaba.
- **POS** (`425d141`): fixtures `create_sale.json` (producto + batido con opción, pago mixto con cambio) y `audit_log_create_sale.json`. El contrato verifica el número `V-…`, el total recalculado, los pagos netos (efectivo 90.000 + transferencia 20.000 con referencia), las líneas con su opción, el stock (5 → 4) y que el reintento con la misma clave devuelve la misma venta. `pnpm test:parity` → 35 en verde.
- **iOS:**
  - **Feature `Checkout`:**
    - Dominio: `SellableProduct`, `ProductOption`, `Cart`, `CartLine`, `PaymentEntry`, `PaymentRules`, `NewSaleRequest`, `SaleReceipt`, `SaleCatalogReading`, `SaleCreating` y `CreateSaleUseCase`.
    - Datos: `CreateSaleParams` y `SupabaseCheckoutRepository`.
    - Presentación: `SellViewModel`, `SellView`, `CheckoutView` y `ReceiptView`.
  - Se abre desde Ventas mediante un presentador del Shell. `AuditValue.list` y `PaymentMethod.rawValue` van en el dominio compartido.
  - Pasan 210 tests unitarios (carrito, reglas de pago, contrato, auditoría, reintento con la misma clave y recuperación) y 22 de interfaz (nuevos: venta de un batido con opción y "sin caja abierta").
- **QA contra el Supabase local:**
  - **Venta:** QA Creatina 300g + QA Batido proteico con "Whey QA" (+3.000) = $103.000. Pagos: efectivo 50.000 + transferencia 60.000 "QA-TRX-1"; cambio 7.000.
  - **Comprobante:** V-000005 por $103.000, con efectivo 43.000 y transferencia 60.000.
  - **Base:** venta `completed` en la caja abierta, con las líneas (batido 18.000 con "Whey QA") y los pagos netos. Salen 1 Creatina (13 → 12) y 0,03 de QA Whey 2lb por la opción. El resumen del día pasa de $1.180.000 a $1.283.000 (7 ventas) y la auditoría registra `create` con `{items: 2, total: 103000, payments: [cash, transfer]}`.
  - **Caja:** las ventas en efectivo del turno quedan en 43.000. La otra sesión registró a la vez un gasto de 18.000 y retiros por 140.000 en la misma caja, así que el esperado es 125.000 + 43.000 − 18.000 − 140.000 = 10.000.
  - **Visto en QA y corregido:** los campos del cobro no se veían dentro de la tarjeta (mismo fondo).

## 26. PLAN-84 — QA integral, migraciones `owner_*` en producción y distribución

- `moveon-owner-ios`: `main` con PLAN-91 subido (`47a9e97`).
- **QA integral contra el Supabase local:**
  - Face ID que no coincide → aviso del sistema; al cancelar queda en la pantalla de desbloqueo. El cajero queda rechazado con "Acceso solo para administradores…". Un correo inválido muestra su error y el admin entra con contraseña.
  - El resumen muestra $1.283.000 en 7 ventas, igual que la RPC.
  - La caja refleja en vivo un gasto anulado por la otra sesión: esperado 125.000 + 43.000 − 140.000 = 28.000.
  - Antes de esto, cada PLAN se verificó en el simulador (§9–§25). Tests: 210 unitarios y 22 de interfaz en iOS; 35 de integración en el POS.
- **Migraciones en producción** (pedido del dueño: "aplica… migraciones owner_* a producción"):
  - **Antes:** producción no tenía funciones `owner_*`, y las dependencias (`get_reinvestment_fund_totals`, `get_monthly_sales_totals`, `get_monthly_expense_totals` y las tablas de gastos y caja) tenían las mismas firmas que en local.
  - **Aplicación:** `20261024120000`, `130000` y `140000` en una sola transacción, con el registro en `schema_migrations`.
  - **Verificación:** `SECURITY INVOKER`, `STABLE`, EXECUTE solo `authenticated`/`postgres`/`service_role` (sin `anon`) y las 3 versiones registradas. Al ejecutarlas como un admin real dentro de un bloque que siempre se revierte, las tres responden: ventas con 20 claves, caja abierta con 13 claves y finanzas con 6 meses de tendencia. No se leyeron cifras del negocio.
- **Distribución:**
  - No hay cuenta Apple Developer de pago (solo la identidad Apple Development personal), así que no hay TestFlight.
  - La versión Release compila para iPhone sin firmar y sin avisos.
  - Hay dos iPhone emparejados ("iPhone de Ander" e "iPhone de Vevita").
  - **Pendiente de decisión del dueño:** instalar una versión que apunte a producción en su iPhone. Es irreversible en el sentido de que la app escribe datos reales; los pasos están en el módulo.
- **Datos de QA creados en local en esta sesión** (solo local): productos y categoría "QA iOS…", ventas V-000005, entradas, ajustes y traslados de QA Creatina y la anulación de V-000002.

## 27. Punto de venta completo — enmienda del ADR 0022 y PLAN-92

- **Pedido del dueño:** "debemos poner la parte de punto de venta donde están todos los productos podemos agregarlos y finiquitar venta incluido descuento asociar cliente y esas cosas, creo que anteriormente lo entendiste mal y agregaste un carrito simple".
  - **Respuestas del dueño:** todo lo del web (descuentos, asociar y crear cliente, MOVE ON Club), búsqueda por texto sin cámara, pestaña propia y Finanzas dentro de Resumen.
  - **Decisión:** enmienda §6 del ADR 0022, **aceptada**, con PLAN-92..96 (`bb1e47d`).
- **PLAN-92 (iOS):**
  - Dominio (`Features/Checkout/Domain`): `SellableProduct` (código de barras, categoría, incluidos, `preferredOption`), `SaleCategory`, `IncludedProduct`, `ComboStock`, `CatalogFilter` y `Cart.add(_:)` / `changeOption`.
  - Datos: `SupabaseCheckoutRepository` lee `product_components` con el nombre del incluido y `categorias` activas, y calcula el stock como `resolveStock` del web.
  - Presentación: `SellView` es la pestaña Vender; `CheckoutView` pasa a "Carrito" con el menú de opción; el monto prellenado sigue al faltante mientras no haya pagos. Finanzas va con `embedded` y se abre desde un botón en Resumen; Resumen y Ventas se refrescan al volver.
  - Pasan 220 tests unitarios y 23 de interfaz. Los tests de interfaz cambian porque la app abre en Vender: nuevo test de categorías y agotados, y Finanzas se abre desde Resumen.
- **QA contra el Supabase local:**
  - La cuadrícula coincide con la base: combo con 5 disponibles (mínimo entre 5,97 Whey y 12 Creatina), batido "Bajo pedido" y categoría "QA iOS Barras".
  - El carrito sigue tras ir a Resumen y volver.
  - Cambiar la opción del batido a "Sin proteína" baja el total de $208.000 a $205.000. Visto en QA y corregido: el monto prellenado quedaba en 208.000.
  - Finanzas abre desde Resumen con entradas $1.283.000, igual que el resumen.
  - No se registró ninguna venta en este PLAN.

## 8. Notas adicionales

- Fuentes de datos ya existentes para la app: `get_stock_levels`, `get_monthly_sales_totals`, `get_monthly_expense_totals`, `get_reinvestment_fund_totals`, `list_cash_history_days`.
- Lógica TS que las RPC nuevas deben reproducir (con test de paridad): `reports/data/repositories/reports.repository.ts#getDailyReport`, `reports/domain/services/*`, `cash-register/domain/services/cash-closure.ts` y `cash-movement-summary.ts`, `expenses/domain/services/financial-summary.ts`, `inventory/domain/services/low-stock.ts`.
- RLS de gastos/empleados/plantillas ya es `admin_only`.
