# Módulo: App iOS "MOVE ON Admin"

## Qué es

App nativa para iPhone con la que el admin consulta el negocio (ventas, caja, stock y finanzas) y lo gestiona: registrar y anular ventas, entradas, ajustes y traslados de inventario, y crear y editar productos. Decisión y reglas en **ADR 0021** (lectura) y **ADR 0022** (nombre "Admin" y escrituras); plan en `docs/plan-de-trabajo.md` (PLAN-75..91).

- **Usuario:** solo rol `admin`. Un `cajero` que inicie sesión ve "Acceso solo para administradores" y se cierra su sesión.
- **Nombre:** "MOVE ON Admin" en la app, "MOVE ON" bajo el ícono. Los identificadores de código (`MoveOnOwner`, `co.moveon.owner`, RPC `owner_*`) no cambian.
- **Escrituras (ADR 0022):** solo por las RPC `*_atomic` existentes o el mismo `update` de productos del web; sin escritura offline; confirmación antes de lo irreversible. Ver "Escrituras" más abajo.
- **Backend:** el mismo proyecto Supabase del POS. Sin service role; solo URL + anon key.

## Dónde vive

Repo propio **`moveon-owner-ios`** (ADR 0021 §7), clonado junto a este como `../moveon-owner-ios`. Este documento, el ADR y el plan siguen viviendo aquí; las RPC `owner_*` y sus tests también.

**Reglas de ingeniería: las mismas que `gym_ios`** (decisión del dueño, 2026-10-24), en `moveon-owner-ios/docs/ENGINEERING_RULES.md`: arquitectura limpia, SOLID, patrones aprobados y prohibidos, Swift 6 estricto, errores con `AppError` + `UserMessages`, tests con Swift Testing (nombres en español, fakes en `Support`), definición de hecho. Su §12 registra las decisiones propias de esta app.

```
moveon-owner-ios/
├── project.yml                  # XcodeGen; el .xcodeproj se genera y no se versiona
├── Config/
│   ├── App.xcconfig             # Incluye Secrets.xcconfig
│   ├── Secrets.example.xcconfig # Plantilla
│   └── Secrets.xcconfig         # Fuera de git; lo genera scripts/make_secrets.sh
├── MoveOnOwner/
│   ├── App/                     # @main, AppDependencies (composition root), RootView, Demo/ (solo DEBUG)
│   ├── Core/{Config,Errors,Logging,Forms,Theme,Components}
│   ├── Data/Supabase/           # Cliente y SupabaseErrorMapper (solo Data importa SDKs)
│   └── Features/<Feature>/{Domain,Data,Presentation}
├── MoveOnOwnerTests/            # Espejo de MoveOnOwner/ + Support/ (fakes)
├── docs/ENGINEERING_RULES.md
└── scripts/make_secrets.sh
```

Un solo target de app, como `gym_ios` (sin paquetes SPM locales hasta el disparador de modularización de sus reglas, §2.4). Presentación depende solo de protocolos del dominio; `AppDependencies` es el único sitio que conoce las implementaciones (equivalente a `<feature>.providers.ts`, ADR 0015).

## Pantallas (v1)

| Pantalla | Fuente de datos | PLAN |
|---|---|---|
| Login, gate de rol, Face ID | Supabase Auth + `user_tiendas` | 77 |
| Dashboard "Hoy" + selector de período (hecho) | RPC `owner_sales_summary`, `cash_sessions` abierta, `get_stock_levels` + `productos` activos | 78, 79 |
| Ventas: lista y detalle (hecho) | `sales`, `sale_items`, `payments`, `clientes(nombre)` (lectura directa, RLS) | 80 |
| Caja: turno actual e historial (hecho) | RPC `owner_cash_session_summary`, `cash_movements`, `cash_sessions` cerradas | 81 |
| Stock (hecho) | `productos` activos + `get_stock_levels`, `inventory_movements` | 82 |
| Finanzas (hecho) | RPC `owner_finance_summary`, `get_monthly_sales_totals`, `get_monthly_expense_totals`, `get_reinvestment_fund_totals` | 83 |

## Autenticación (PLAN-77)

- `Features/Auth/Domain`: `AuthRepository` (contrato; lanza `AppError`), `OwnerAccess` (solo `admin`; con varias tiendas toma la primera donde es admin), `ResolveOwnerAccessUseCase` (lee `user_tiendas` y **cierra sesión** si no es admin o si no se pudo comprobar), `BiometricAuthenticating`.
- `Features/Auth/Data`: `SupabaseAuthRepository` (sesión en Keychain vía SDK; renovación con límite de 10 s como `GET_SESSION_TIMEOUT_MS`; `signOut(scope: .local)`), `UserTiendaDTO`, `DeviceBiometricAuthenticator`.
- `Features/Auth/Presentation`: `SessionStore` (fases comprobando / login / Face ID / dentro), `LoginViewModel`, `ForgotPasswordViewModel`. Validación y textos iguales a `loginFormSchema` y `login-error-mapper.ts` del web (`Core/Forms/Validators`, `Core/Errors/UserMessages`).
- **Regla del dueño (2026-10-24): basta con contraseña o Face ID.** Con sesión guardada se pide Face ID (sin respaldo con el código del iPhone); "Entrar con contraseña" vuelve al login. Si el teléfono no tiene Face ID, la sesión guardada se cierra y se pide la contraseña. No se bloquea al pasar a segundo plano.
- "¿Olvidaste tu contraseña?" envía el enlace a `PASSWORD_RESET_URL` (la página `/restablecer-contrasena` del POS web); la contraseña nueva se define allá. Mensaje genérico para no revelar si el correo existe.
- Usuario de prueba local adicional: `cajero@moveon.local` / `Test1234!` (rol `cajero`, solo en el stack local) para verificar el rechazo.

## Escrituras (ADR 0022)

| Operación | Camino | PLAN |
|---|---|---|
| Base: validación, mensajes de rechazo, auditoría, confirmación, envío único, sin conexión (hecho) | — | 86 |
| Entrada de mercancía (hecho) | `register_inventory_entry_atomic` | 87 |
| Ajuste / traslado (hecho) | `adjust_stock_atomic` / `transfer_stock_atomic` (+ auditoría como el web) | 88 |
| Crear / editar producto (hecho) | `create_product_with_initial_stock` / `update` de `productos` | 89 |
| Anular venta (hecho) | `void_sale_atomic` | 90 |
| Registrar venta | `create_sale_atomic` (caja abierta, idempotencia) | 91 |

- **Contrato de payloads (PLAN-85):** `tests/integration/fixtures/ios-payloads/*.json` es exactamente lo que la app envía (`kind` `rpc` o `insert`, `target`, `payload` con marcadores `"{{id}}"`; formato en el `README.md` de esa carpeta). `tests/integration/ios-payloads.contract.test.ts` envía cada uno al Supabase local y verifica el efecto, y falla si un fixture no tiene caso. Los tests Swift comparan el JSON de la app con una copia en `MoveOnOwnerTests/Fixtures/Payloads/` que mantiene `scripts/sync_payload_fixtures.sh` (repo iOS; `--check` compara). Corre con `pnpm test:parity`.
- **Base (PLAN-86, repo iOS):** `Submission` (`Core/Forms`: una escritura a la vez, nada sin conexión, error de `UserMessages`), `ConfirmationSheet` (`Core/Components`), `ConnectivityChecking` (`NWPathMonitor`), `AuditLogging` + `SupabaseAuditLogger` (`Domain/Audit`, `Data/Audit`) y `ServerRejectionMapper`: los `raise exception` de las RPC (`P0001`) se reconocen por el mensaje y se muestran con textos propios (`AppError.rejected`); uno desconocido da el mensaje genérico. Patrón: el view model valida los campos con los textos de los schemas del web y el caso de uso de escritura revalida, llama al repositorio y audita.
- **Entrada de mercancía (PLAN-87):** botón "Registrar entrada" en el detalle del producto y acción "Entrada" al deslizar la fila en Stock (solo productos con stock propio). Cantidad (1 por defecto, decimales permitidos como el schema), ubicación (bodega por defecto), costo por unidad precargado con el vigente (0 o vacío = sin costo; con costo, la RPC actualiza el costo del producto y la compra entra al fondo de reinversión) y motivo opcional (≤ 200). Muestra el total de la compra y, al guardar, los avisos del web; el stock, el kardex y la lista se recargan del servidor. Sin auditoría desde el cliente (el web tampoco la hace para entradas).
- **Ajustes y traslados (PLAN-88):** botones Ajustar y Trasladar en el detalle y acciones al deslizar la fila a la izquierda en Stock. Ajuste: Restar/Sumar (en el iPhone el teclado numérico no tiene "−"), cantidad, ubicación (punto de venta por defecto, como el web), vista previa "6 → 5" y motivo de 3 a 200 caracteres; restar pide confirmación. Traslado: dirección (bodega → punto de venta por defecto), cantidad que no pase de lo disponible en el origen ("Stock insuficiente en origen. Disponible: N", como el web) y motivo obligatorio. Ambos auditan con los `changes` del web (`cantidadDelta`/`ubicacion`/`motivo` y `from`/`to`/`cantidad`/`motivo`); la etiqueta es el nombre del producto, mientras que el web guarda ahí el id. El trigger del servidor sigue registrando además `inventory.adjusted`.
- **Productos (PLAN-89):** "+" en la barra de Stock crea un producto o ingrediente con categoría, precio (entero), costo, IVA (0/5/19), mínimo (entero) e inventario inicial en bodega o en el punto de venta. Los batidos y combos necesitan componentes y se crean en el web. "Editar" en el detalle cambia nombre, SKU, código de barras, categoría, precio, costo, IVA, mínimo y activo; se envía solo lo que cambió y vaciar un campo lo deja en `null`. Proveedor, textos del catálogo, imagen, unidad, fidelización, opciones y combos siguen en el web. Usa los textos de `productFormSchema`; el SKU se pasa a mayúsculas. SKU o código de barras repetidos (`ux_productos_tienda_sku`/`_barcode`, `23505`) muestran "Ya existe un producto con ese SKU/código de barras". Auditoría `create` (`tipo`, `precioVenta`, `costo`, `ivaTasa`) y `update` con las claves del web, solo los campos cambiados; el trigger `tr_audit_productos_price` sigue registrando los cambios de precio y costo.
- **Anular venta (PLAN-90):** botón rojo "Anular venta" al final del detalle de una venta vigente. La hoja muestra "Vas a anular la venta V-…", el resumen (número, total, fecha), lo que pasa con el stock y la caja, y el motivo (10 a 200 caracteres, como el diálogo del web). La RPC devuelve el stock al punto de venta (también los componentes de batidos y combos) y revierte el Club. Aviso "Venta V-… anulada"; el detalle y la lista se recargan. Auditoría `venta`/`void` con `{reason}`.
- **Auditoría:** el web registra en `audit_logs` algunos cambios desde el cliente (ajuste, traslado, productos, anulación…) además de los triggers. La app registra los mismos eventos con los mismos campos (`entity_type`, `action`, `changes`); la política `audit_logs_insert_own` solo deja insertar con el propio `user_id`. Un fallo de auditoría nunca rompe la escritura (igual que el web).

## Dashboard "Hoy" (PLAN-79)

- `Features/Dashboard`: `LoadDashboardUseCase` lee en paralelo el resumen de ventas del período (`owner_sales_summary`), la caja abierta (`cash_sessions` con `status = 'open'`) y el stock (`get_stock_levels` cruzado con `productos` activos, igual que `getStockLevels` del web).
- Pantalla: cifras (total vendido, ventas y anuladas, ticket promedio, utilidad con costo conocido), caja ("abierta desde las 9:05 a. m."; si se abrió otro día, con la fecha), stock (agotados y con stock bajo según `low-stock.ts`, sin batidos ni combos), ventas por hora (Swift Charts), métodos de pago y los 5 productos que más facturaron.
- Períodos: control segmentado Hoy · Ayer · 7 días · Mes y botón de calendario para un rango de hasta un año. Días en la zona de la tienda (`LocalDate`, America/Bogota).
- Estados: carga, error con reintento, sin ventas en el período, y refresco al tirar (conserva los datos y avisa si falla).
- Modo demo `-demo` (solo DEBUG) y 6 tests de UI sobre él; 81 tests unitarios.
- Verificado en el simulador contra el Supabase local: las cifras de la app coinciden con la RPC consultada directamente (total $ 645.000, 5 ventas, utilidad $ 270.000).

## Finanzas (PLAN-83)

- **RPC** `owner_finance_summary(p_tienda_id uuid, p_month date) → jsonb` (migración `20261024140000`; solo admin, `security invoker`, `stable`). Replica `buildFinancialSummary` del web sobre el mes en `tiendas.timezone`: `month`, `timezone`, `entradas_totales`, `entradas_por_metodo` (cash, transfer, card, other, con `pct`), `costo_productos_vendidos` (`null` si ningún producto vendido tiene costo), `ventas_sin_costo`, `unidades_sin_costo`, `gastos_total`, `por_categoria` (con `pct` sobre entradas), `pct_gastos_sobre_entradas`, `utilidad_neta`, `margen_neto`, `fondo` (`get_reinvestment_fund_totals`; `null` si no está configurado) y `tendencia` (6 meses que terminan en `p_month`, de `get_monthly_sales_totals` + `get_monthly_expense_totals`). Porcentajes con un decimal como el web.
- **Paridad:** `tests/integration/owner-finance-summary.parity.test.ts` (4 tests: mismas cifras que el web para mes, fondo y tendencia; cifras esperadas fijas; sin fondo → `null`; otra tienda o sin sesión rechazados). `pnpm test:parity` → 21 en verde.
- **Pestaña Finanzas:** un mes a la vez con flechas (sin meses futuros); resultado del mes (utilidad neta, margen, entradas − costo − gastos), entradas por método, gastos por categoría, fondo de reinversión y gráfica de 6 meses (Swift Charts) con el balance entradas − gastos de cada mes.
- Verificado contra el Supabase local (octubre): utilidad $ 115.000, margen 16,4 %, entradas $ 700.000, costo $ 390.000, gastos $ 195.000, fondo disponible −$ 460.000; tendencia sept $ 385.000 / oct $ 505.000. Idéntico a la RPC.

## Stock (PLAN-82)

- Pestaña **Stock**: productos activos con stock en punto de venta y bodega y su mínimo, leídos como `getStockLevels` del web (`productos` activos + `get_stock_levels`; sin movimientos = 0). Filtros Todos · Bajo (n) · Agotados (n) y búsqueda por nombre o SKU sin tildes ni mayúsculas, ambos locales. Orden del reporte de stock del web: agotados, bajos, nombre.
- Regla de `low-stock.ts`: agotado = punto de venta ≤ 0; bajo = punto de venta ≤ mínimo; batidos y combos nunca alertan. "Bajo" no repite los agotados (mismas cuentas que la alerta del dashboard).
- Detalle: stock por ubicación y los últimos 100 movimientos de `inventory_movements` (como `getKardex`), con las etiquetas del web (Entrada, Venta, Ajuste, Anulación, Traslado de salida/entrada) y la cantidad con signo.
- Verificado contra el Supabase local: niveles iguales a `get_stock_levels` (Creatina 7, Whey 9, batido y combo sin stock propio) y kardex de Creatina igual a `inventory_movements`.

## Caja (PLAN-81)

- **Turno actual:** RPC `owner_cash_session_summary(p_tienda_id, p_session_id default null)` (migración `20261024130000`): sin sesión devuelve el turno abierto o `null` si la caja está cerrada. Salida: `session_id`, `status`, `opened_at`, `opening_amount`, `sales_total`, `cash_sales_amount`, `cash_in_amount`, `expense_amount`, `cash_out_amount`, `correction_amount`, `movements_total`, `expected_cash_amount` y `payment_breakdown` (`metodo`, `count`, `total`). Efectivo esperado = base + ventas en efectivo + entradas − gastos − retiros − correcciones (la fórmula de `computeCashTurnSummary` y de `close_cash_session_atomic`). Solo admin, `security invoker`, `stable`. Movimientos: lectura directa de `cash_movements` (anulados tachados).
- **Paridad:** `tests/integration/owner-cash-session-summary.parity.test.ts` contra `getPaymentBreakdown` + `computeCashTurnSummary` (turno abierto, por id, cerrado; venta anulada y gasto anulado excluidos; caja cerrada → `null`; cajero y otra tienda rechazados). Las utilidades compartidas de las paridades están en `tests/integration/support/local-stack.ts`; corren una a la vez.
- **Historial:** lectura directa de `cash_sessions` cerradas en el período (por `closed_at`), paginada de 30, con esperado, contado y diferencias **guardados por `close_cash_session_atomic`**; no se usa `list_cash_history_days` (agrupa por día y no trae esperado vs. contado). La diferencia se resalta con la regla de `cash-closure.ts` (0 = cuadrada; más de $5.000 en rojo). **Signo:** el servidor guarda esperado − contado (positivo = faltan, negativo = sobran), igual que lo pinta el web.
- Verificado contra el Supabase local: esperado $ 740.000 = base 125.000 + efectivo 595.000 + entrada 20.000 (idéntico a la RPC), movimientos iguales a la base, y el historial de septiembre con los cierres guardados y su sobrante/faltante correcto.

## Ventas (PLAN-80)

- Pestañas **Resumen** y **Ventas** (`Features/Shell`).
- Lista del período (Hoy · Ayer · 7 días · Mes · fechas), más recientes primero, paginada de 50 en 50: número, hora (y fecha si el período tiene varios días), cajero, métodos de pago, total; las anuladas con etiqueta "Anulada" y el total tachado.
- Búsqueda por número en **todas las fechas** (`ilike` con comodines escapados, sin mayúsculas/minúsculas), 400 ms después de la última tecla.
- Detalle con los mismos bloques que `sale-detail-list.component.ts` del web (productos con opción y descuentos, resumen, pagos con referencia, total recibido y cambio, usuario, cliente o "Consumidor final", fecha y hora) más el **canje del Club** por línea y en el resumen, y una tarjeta "Venta anulada" con motivo y hora.
- Verificado contra el Supabase local: la lista coincide fila por fila con `sales` del día (incluida una anulada y un pago mixto) y la búsqueda encuentra ventas de cualquier fecha.

## RPC `owner_sales_summary` (PLAN-78)

Migración `20261024120000_owner_sales_summary.sql`. `owner_sales_summary(p_tienda_id uuid, p_from date, p_to date) → jsonb`.

- **Acceso:** `security invoker` + `stable` (RLS sigue filtrando); exige sesión y rol `admin` activo en la tienda, si no `42501`. Rango `p_to ≥ p_from` y como máximo un año, si no `22023`. `execute` solo para `authenticated`.
- **Período:** `[p_from 00:00, p_to + 1 00:00)` en `tiendas.timezone` (igual que `getStoreRangeUtc`).
- **Salida (snake_case):** `from`, `to`, `timezone`, `total_ventas`, `count_ventas`, `count_anuladas`, `subtotal_ventas`, `tax_total`, `discount_total`, `item_discount_total`, `global_discount_total`, `discounted_sales_count`, `average_discount_percentage`, `avg_venta`, `utilidad_total`, y las listas `payment_breakdown` (`metodo`, `count`, `total`), `product_sales` (`product_id`, `nombre`, `sku`, `num_ventas`, `qty`, `total`, `avg_price`, `costo_unitario`, `costo_total`, `utilidad`, `margen_pct`), `cashier_breakdown` (`cashier_id`, `cashier_email`, `count_completed`, `count_voided`, `total_ventas`, `tax_total`), `hourly_sales` y `daily_sales` (`hour`/`date`, `count`, `total`, `avg_ticket`).
- **Semántica = web:** totales solo de completadas; el canje del Club cuenta como descuento (`discount_total` lo incluye, como en el web); utilidad solo con costo conocido (un producto con alguna línea sin costo queda en `null`); una línea canjeada en 0 con costo da utilidad negativa, igual que en `/reportes`.
- **Paridad:** `pnpm test:parity` (`tests/integration/owner-sales-summary.parity.test.ts`, config `vitest.integration.config.ts`). Necesita el Supabase local corriendo; crea dos usuarios y una tienda de prueba, carga `tests/integration/fixtures/owner-sales-summary.sql` con psql en el contenedor, compara la RPC con `buildSalesSummary` sobre las mismas filas y borra todo al final. Cubre: venta a las 23:30 local, anulada, pago mixto, descuento global, combo con costo fraccionario, canje del Club, línea sin costo, cambio de nombre del producto, ventas fuera del período y de otra tienda, cajero rechazado, sin sesión, rango inválido. No corre en `pnpm test`.
- **Estado:** aplicada solo en el Supabase local. Al remoto se aplica con confirmación del dueño (antes de publicar la app, PLAN-84).

## Reglas

1. **No se reimplementan reducciones de negocio en Swift** (totales, utilidad, cuadres). Salen de RPC `owner_*` (`security invoker`, `stable`), cada una con un test de paridad contra el servicio TS que hoy calcula lo mismo:
   - `owner_sales_summary` ↔ `buildSalesSummary` (`reports/domain/services/sales-summary.ts`, la parte pura de `getDailyReport`)
   - `owner_cash_session_summary` ↔ `cash-register/domain/services/cash-closure.ts` y `cash-movement-summary.ts`
   - `owner_finance_summary` ↔ `expenses/domain/services/financial-summary.ts`
2. Sí se portan a Swift (con tests) reglas de presentación pequeñas: formato COP sin decimales (`es_CO`), fechas en `tiendas.timezone` (`America/Bogota`) y la regla de stock bajo de `low-stock.ts`.
3. Textos de UI en español; código en inglés.
4. Toda escritura futura (v2) pasa por una RPC `*_atomic`, nunca `insert`/`update` directos.
5. Pruebas con datos siempre contra Supabase local. El simulador llega a `http://127.0.0.1:54321`.

## Comandos

Desde `../moveon-owner-ios`:

```bash
brew install xcodegen                 # una vez
scripts/make_secrets.sh               # Config/Secrets.xcconfig con el Supabase LOCAL
xcodegen generate
xcodebuild test -project MoveOnOwner.xcodeproj -scheme MoveOnOwner \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

`scripts/make_secrets.sh ruta/.env` apunta a otro backend (solo para producción, nunca para pruebas con datos).

## Distribución

Cuenta Apple Developer + TestFlight interno (ADR 0021 §6). Mientras no exista la cuenta: firma personal de Xcode en el iPhone del dueño (expira cada 7 días). **Pendiente:** decisión del dueño sobre la cuenta. Mientras tanto se trabaja con simulador y firma personal; la cuenta solo es necesaria en PLAN-84.
