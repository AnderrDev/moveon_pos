# Módulo: App iOS del dueño

## Qué es

App nativa para iPhone con la que el dueño consulta el negocio fuera de la tienda: ventas, caja, stock y finanzas. Decisión y reglas en **ADR 0021**; plan en `docs/plan-de-trabajo.md` (PLAN-75..84).

- **Usuario:** solo rol `admin`. Un `cajero` que inicie sesión ve "Acceso solo para el dueño" y se cierra su sesión.
- **v1 de solo lectura.** No vende, no anula, no ajusta inventario ni registra gastos.
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
| Finanzas | RPC `owner_finance_summary` (nueva), `get_monthly_sales_totals`, `get_monthly_expense_totals`, `get_reinvestment_fund_totals` | 83 |

## Autenticación (PLAN-77)

- `Features/Auth/Domain`: `AuthRepository` (contrato; lanza `AppError`), `OwnerAccess` (solo `admin`; con varias tiendas toma la primera donde es admin), `ResolveOwnerAccessUseCase` (lee `user_tiendas` y **cierra sesión** si no es admin o si no se pudo comprobar), `BiometricAuthenticating`.
- `Features/Auth/Data`: `SupabaseAuthRepository` (sesión en Keychain vía SDK; renovación con límite de 10 s como `GET_SESSION_TIMEOUT_MS`; `signOut(scope: .local)`), `UserTiendaDTO`, `DeviceBiometricAuthenticator`.
- `Features/Auth/Presentation`: `SessionStore` (fases comprobando / login / Face ID / dentro), `LoginViewModel`, `ForgotPasswordViewModel`. Validación y textos iguales a `loginFormSchema` y `login-error-mapper.ts` del web (`Core/Forms/Validators`, `Core/Errors/UserMessages`).
- **Regla del dueño (2026-10-24): basta con contraseña o Face ID.** Con sesión guardada se pide Face ID (sin respaldo con el código del iPhone); "Entrar con contraseña" vuelve al login. Si el teléfono no tiene Face ID, la sesión guardada se cierra y se pide la contraseña. No se bloquea al pasar a segundo plano.
- "¿Olvidaste tu contraseña?" envía el enlace a `PASSWORD_RESET_URL` (la página `/restablecer-contrasena` del POS web); la contraseña nueva se define allá. Mensaje genérico para no revelar si el correo existe.
- Usuario de prueba local adicional: `cajero@moveon.local` / `Test1234!` (rol `cajero`, solo en el stack local) para verificar el rechazo.

## Dashboard "Hoy" (PLAN-79)

- `Features/Dashboard`: `LoadDashboardUseCase` lee en paralelo el resumen de ventas del período (`owner_sales_summary`), la caja abierta (`cash_sessions` con `status = 'open'`) y el stock (`get_stock_levels` cruzado con `productos` activos, igual que `getStockLevels` del web).
- Pantalla: cifras (total vendido, ventas y anuladas, ticket promedio, utilidad con costo conocido), caja ("abierta desde las 9:05 a. m."; si se abrió otro día, con la fecha), stock (agotados y con stock bajo según `low-stock.ts`, sin batidos ni combos), ventas por hora (Swift Charts), métodos de pago y los 5 productos que más facturaron.
- Períodos: control segmentado Hoy · Ayer · 7 días · Mes y botón de calendario para un rango de hasta un año. Días en la zona de la tienda (`LocalDate`, America/Bogota).
- Estados: carga, error con reintento, sin ventas en el período, y refresco al tirar (conserva los datos y avisa si falla).
- Modo demo `-demo` (solo DEBUG) y 6 tests de UI sobre él; 81 tests unitarios.
- Verificado en el simulador contra el Supabase local: las cifras de la app coinciden con la RPC consultada directamente (total $ 645.000, 5 ventas, utilidad $ 270.000).

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
