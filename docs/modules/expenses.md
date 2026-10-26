# Módulo: expenses (Finanzas — gastos del negocio)

## Responsabilidad

Relacionar los **gastos del negocio con las entradas totales** del período: nómina simulada, arriendo, servicios, mantenimiento, insumos y demás egresos, con la vista central **Entradas − Costo de productos − Gastos = Utilidad neta** y el % de cada categoría sobre los ingresos.

> **No es un módulo legal/fiscal.** No emite nómina electrónica DIAN, no calcula PILA ni prestaciones. La nómina es el salario acordado con cada empleado como costo total (decisión del dueño, sesión 2026-07-04). Simula el patrón de los POS comerciales (expense ledger + pay-out de caja, estilo Loyverse).

## Reglas de negocio

- **Solo admin.** Ruta `/finanzas` con `roleGuard('admin')` y RLS `admin_only` (rol en `user_tiendas`) en las 4 tablas.
- **Los gastos no se borran.** Se anulan con motivo auditado (`status='voided'`, `voided_by/at/reason`), motivo mínimo 10 caracteres (mismo umbral que caja).
- **Gasto pagado con `efectivo_caja`** exige caja abierta: la RPC `register_expense_atomic` crea el `cash_movement` tipo `expense` y el gasto **en la misma transacción** (el cierre de caja sigue cuadrando). Sin caja abierta la RPC falla con `NO_OPEN_CASH_SESSION` (mensaje amigable en UI).
- **Nómina:** pagos tipo mes completo / quincena 1 / quincena 2 / adelanto. Las dos quincenas siempre suman el salario exacto (`buildNominaPagoSugerido`). El gasto lleva `empleado_id` y `periodo` (`YYYY-MM` o `YYYY-MM-Q1/Q2`).
- **Entradas totales** = `DailyReport.totalVentas` (ReportsService, misma fuente que `/reportes`). **Costo de productos** = suma de `productSales.costoTotal` (null si ningún producto tiene costo capturado — se muestra "—", nunca se asume 0).
- Las entradas del período se muestran además por método de pago (`paymentBreakdown` de reportes), principalmente efectivo y transferencia, para control operativo.
- **Fondo de reinversión de mercancía:** el costo de lo vendido no se trata como gasto operativo ni utilidad disponible. Desde una fecha configurable por tienda:
  `disponible = saldo_inicial + costo_vendido_acumulado - compras_mercancia_acumuladas`.
  Las compras de mercancía se registran como entradas de inventario con `costo_unitario`; si una entrada no tiene costo, no descuenta del fondo y se muestra advertencia. Corregir el costo de una entrada mediante `correct_inventory_entry_cost_atomic` actualiza estos agregados inmediatamente, sin crear un gasto ni cambiar la cantidad en stock.

## Datos (migrations `20260704_002`, `20260704_003` y `20260708_001`)

- `empleados` — nombre, cargo, `salario_mensual` (costo total acordado), `is_active`.
- `expense_categories` — seed por tienda: nomina, arriendo, servicios, mantenimiento, insumos, marketing, transporte, otros (`tipo` fijo/variable, editable).
- `expenses` — categoría, empleado opcional, concepto, monto, `fecha_gasto` (date local), `metodo_pago` (`efectivo_caja|efectivo_externo|transferencia|tarjeta`), `cash_movement_id`, `periodo`, status + campos de anulación.
- `expense_templates` — plantillas recurrentes de gastos fijos. Son **configuración**, no registros transaccionales: borrado físico permitido (mismo criterio que clientes).
- `reinvestment_fund_settings` — configuración por tienda del fondo (`saldo_inicial`, `fecha_inicio`), solo admin.
- RPC `register_expense_atomic(...)` — security invoker, parámetros opcionales con `default null`.
- RPC `get_reinvestment_fund_totals(...)` — devuelve costo vendido y compras de mercancía acumuladas desde la fecha de inicio del fondo, más desglose del mes visible. Usa RLS/security invoker.

## Estructura

```
apps/pos-angular/src/app/features/expenses/          (estructura ADR 0015)
  expenses.providers.ts                    composition root (ExpenseRepository → ExpensesRepository)
  domain/
    entities/expense.entity.ts             Expense, ExpenseCategory, Empleado, ExpenseTemplate
    repositories/expense.repository.ts     contrato abstract class (impl. en data/)
    services/financial-summary.ts          buildFinancialSummary (núcleo, puro + tests)
    services/nomina.ts                     buildNominaPagoSugerido, pagadoPorEmpleado (+ tests)
    services/monthly-comparison.ts         lastMonths, buildMonthlyComparison (+ tests)
    services/reinvestment-fund.ts          buildReinvestmentFund (+ tests)
    dtos/expense.dto.ts                    createExpenseSchema, voidExpenseSchema (Zod)
    dtos/empleado.dto.ts                   saveEmpleadoSchema
    dtos/fund-settings.dto.ts              saveFundSettingsSchema
    dtos/template.dto.ts                   saveTemplateSchema
    usecases/register-expense.use-case.ts  Result<Expense, {code:'validation'}>
    usecases/void-expense.use-case.ts      (+ save-empleado, save-fund-settings,
                                            save-template, delete-template)
  data/
    repositories/expenses.repository.ts    impl. Supabase del contrato del dominio
  presentation/
    pages/finanzas.page.ts                 orquestador (mes visible, carga, diálogos)
    presenters/expense-form.presenter.ts   presenter Zod del form de gasto
    forms/expense-form.{factory,mapper}.ts patrón 3 archivos
    forms/empleado-form.{factory,mapper}.ts
    forms/nomina-pago-form.{factory,mapper}.ts
    forms/fund-settings-form.{factory,mapper}.ts
    dialogs/expense-form.dialog.ts         registrar gasto
    dialogs/empleado-form.dialog.ts        crear/editar empleado
    dialogs/nomina-pago.dialog.ts          pagar nómina (precarga por tipo)
    dialogs/fund-settings.dialog.ts        configurar saldo inicial y fecha de inicio
    dialogs/recurrentes.dialog.ts          gastos del mes (plantillas)
    dialogs/template-form.dialog.ts        crear/editar plantilla
    components/financial-summary.component.ts  KPIs + estado del período + % por categoría
    components/nomina-section.component.ts     empleados con pagado vs. acordado
    components/expense-list.component.ts       tabla de gastos con anulación
    components/monthly-comparison.component.ts últimos 6 meses
    components/reinvestment-fund.component.ts  fondo de reinversión
    services/expense-export.ts             export Excel de /finanzas
```

## Recurrentes y export (PLAN-49)

- **"Gastos del mes"** (`recurrentes.dialog.ts`): lista las plantillas activas cruzadas con los gastos del mes visible (`templateStatusForMonth`, dominio puro). "Registrar" abre el form de gasto **prellenado** (categoría/concepto/monto) con `periodo = mes visible`; al guardarse, la plantilla pasa a "Registrado este mes". Coincidencia por concepto + categoría + período (las quincenas cuentan para su mes).
- **Export Excel** desde `/finanzas` (`expense-export.ts`): hojas `Resumen` (estado del período + % por categoría), `Gastos` (incluye anulados con motivo) y `Comparativa`. Se exporta desde el módulo con datos ya cargados (ADR 0011) — no se tocó el Excel de `/reportes`.
- La hoja `Resumen` incluye entradas por método de pago. Si el fondo está configurado, también incluye saldo inicial, apartado por ventas, invertido en mercancía y disponible para reinvertir.

## Limitaciones conocidas

- La comparativa mensual depende de que arriendo y nómina estén registrados en cada mes: si faltan, la ganancia de ese mes se ve más alta (avisado en la UI).
- Probado end-to-end en Chrome contra producción (2026-07-05): CRUD de gastos, nómina, plantillas, export y guards de rol. Ver `docs/sessions/2026-07-05-finanzas-cierre-plan49.md`.

## Gastos idempotentes (2026-10-24, `20261024000800`)

`register_expense_atomic` acepta `p_idempotency_key` (opcional; `expenses.idempotency_key` con índice único por tienda). Los diálogos de gasto y de pago de nómina generan una clave **cada vez que se abren** (los diálogos se reutilizan entre aperturas) y la reenvían en los reintentos: un reintento devuelve el gasto ya registrado sin duplicar el egreso de caja. Sin clave, el comportamiento es el de antes.

## Gastos de caja y anulación sincronizada (Ola 1, 2026-10-24, `20261024160000`–`170000`)

- **Un "Gasto" registrado desde Caja es un gasto de Finanzas.** `add_cash_movement_atomic` con `tipo = 'expense'` crea en la misma transacción la fila de `expenses` (categoría `Gastos de caja`, slug `caja`, creada por tienda la primera vez con `ensure_cash_expense_category`; método `efectivo_caja`; fecha local de la tienda; concepto = motivo del movimiento). Antes solo existía en caja y la utilidad neta no lo restaba (146 movimientos / $2.338.646 en producción al 2026-10-24).
- **Recuperación de históricos:** `20261024170000_backfill_cash_expenses.sql` crea el gasto de cada movimiento `expense` activo sin gasto. Es un cambio de datos: en producción solo con OK del dueño. Idempotente.
- **Anular es simétrico.** `void_expense_atomic` (admin) anula el gasto y su salida de caja; `void_cash_movement_atomic` anula también el gasto enlazado. `correct_cash_movement_atomic` copia el monto (y el concepto, sin el prefijo `Gasto: `) al gasto enlazado.
- **`expenses` sin escritura directa:** se revocaron `INSERT/UPDATE/DELETE` a `anon` y `authenticated`. Todo pasa por `register_expense_atomic`, `void_expense_atomic` o las RPC de caja.
- **Compras de mercancía:** **no** restan de la ganancia (su costo entra cuando se vende); las sigue el fondo de reinversión. (El "Dinero del período"/"Plata libre" se retiró el 2026-10-26, ver abajo.)
- Prueba: `supabase/tests/cash-expenses-sync.test.sql`.

## Fondo en negativo = inventario de más (2026-10-24)

`Disponible = saldo inicial + costo de lo vendido − compras de mercancía`. Cuando queda negativo **no es una deuda**: se compró más mercancía de la que se ha recuperado vendiéndola al costo, y esa diferencia está en estantería (en producción, al 2026-10-24: −$10,8 M con el inventario pasando de ~$6,0 M a $15,6 M al costo desde julio). La tarjeta del fondo:

- titula el saldo negativo "Invertido en inventario de más", lo muestra en positivo y en ámbar (no en rojo), y explica que se recupera al vender;
- muestra **Inventario hoy al costo** (`valueStockAtCost` en `features/inventory/domain/services/stock-valuation.ts`: Σ stock total × costo vigente de productos activos con stock propio; stock negativo cuenta 0; avisa productos con stock sin costo);
- sugiere registrar el saldo inicial si el fondo arrancó en $0.

`fundBalanceKind` (`reinvestment-fund.ts`) decide la lectura. Tests: `tests/unit/features/inventory/stock-valuation.test.ts`. Sin cambios en la base.

## Gastos fijos y lista de compras (2026-10-24)

- **Gastos fijos del mes** (`domain/services/fixed-commitments.ts`, tarjeta `mo-fixed-commitments`): plantillas activas (mensual = monto; quincenal = 2 × monto) + salario de empleados activos. Pagado = gastos activos del mes con la misma categoría y concepto (plantillas) o ligados al empleado (nómina). Lo pendiente se avisa en el resumen (solo en el mes en curso): "faltan $X; al pagarlos la ganancia quedará en $Y" (`utilidadTrasFijos`). Hasta el 2026-10-26 se restaba de un "Dinero libre". Decisión del dueño: arriendo $2.500.000 (plantilla) y empleado $1.800.000 (salario) siempre fijos.
- **Lista de compras** (`/finanzas/compras`, `presentation/pages/compras.page.ts`): pronóstico por producto con `buildPurchasePlan` (`features/inventory/domain/services/purchase-suggestions.ts`); ver "Asesor de compras" abajo para el modelo vigente:
  - consumo diario = 0,6 × promedio 14 días + 0,4 × promedio 56 días, desde `sale_exit` − `void_return` (incluye componentes de batidos y combos), **sin los días que cerraron agotados**; productos nuevos promedian sobre los días que llevan, mínimo 7;
  - necesario = ⌈máx(consumo × días + 1σ·√días, stock mínimo) − stock total⌉;
  - orden: menos días de stock primero, luego mayor margen diario;
  - presupuesto (por defecto lo disponible del fondo, editable): se llena en orden; completo, parcial o "sin presupuesto"; nunca lo supera. Sin costo registrado no consume presupuesto.
  - Filtro por proveedor (el tope aplica al pedido filtrado) y Excel ordenado por proveedor.
  - No es un modelo de ML: con ~4 meses de historia un pronóstico ponderado es igual de preciso y explicable. Reevaluar con más historia (estacionalidad semanal/mensual).
- Tests: `tests/unit/features/inventory/purchase-suggestions.test.ts`, `tests/unit/features/expenses/fixed-commitments.test.ts`.

## Asesor de compras: seed masivo y backtest (2026-10-24)

- **Seed local** (`pnpm seed:asesor`, `scripts/seed-asesor-compras.sql`; borrar con `pnpm seed:asesor:limpiar`): 180 días hasta ayer en la tienda demo, 40 productos "SIM · …" (estable, en alza, en baja, picos de fin de semana y de quincena, compras esporádicas, 2 lanzamientos, 1 descontinuado, 1 promoción, proveedor lento con agotados, corte de suministro), batidos que consumen insumos y un combo. ~10.300 ventas / 17.400 líneas / 27.400 movimientos. Guarda la demanda real (incluida la perdida por agotado) en `sim.daily_demand`. Determinista; se niega a correr fuera de la base local.
- **Backtest** (`pnpm test:backtest`, `tests/backtest/purchase-advisor.backtest.ts`): 12 fechas (cada 7 días), el pronóstico solo ve lo anterior; se compara con la demanda real de los 14 días siguientes y se simula la compra sugerida. Comprueba además que la historia que arma la app desde los movimientos (`buildDemandHistories`) es idéntica a la del seed.
- **Resultado** (puntaje = margen perdido por agotados + 2% del sobrante al costo):

  | Variante | Error (WAPE) | Servicio | Casos con agotado | Margen perdido | Puntaje |
  |---|---|---|---|---|---|
  | v1: 0,6·14d + 0,4·56d | 8,0% | 97,1% | 109 | $19,4 M | $21,0 M |
  | + sin días agotados | 7,9% | 97,3% | 105 | $14,8 M | $16,5 M |
  | + tendencia (umbral 20%) | 8,3% | 97,4% | 101 | $14,7 M | $16,6 M |
  | **sin agotados + colchón z=1 (vigente)** | **7,9%** | **99,2%** | **47** | **$7,2 M** | **$9,8 M** |
  | sin agotados + tendencia + z=1,28 | 8,3% | 99,4% | 38 | $6,0 M | $9,3 M (con +22% de compra) |

  Excluir días agotados mejora sobre todo los productos que se agotan seguido (servicio 63% → 81%). La tendencia corrige el sesgo de los productos en alza pero empeora los demás: queda como opción apagada (`DEFAULT_FORECAST.trend`). Un colchón mayor (z=1,28) pierde menos ventas pero inmoviliza más dinero; se eligió z=1 por la prioridad del dueño de no gastar de más. Limitaciones: compras esporádicas (accesorios) y promociones puntuales siguen con error alto; con más historia real conviene volver a correr el backtest.

## Un solo resultado (2026-10-26)

El dueño no entendía la página: veía "Ganancia", "Plata libre" y una comparativa "Ventas − gastos" con cifras distintas para el mismo mes. Ahora:

- **Un solo resultado: Ganancia = ventas − costo de lo vendido − gastos.** El resumen lo muestra como una cuenta en 4 tarjetas (`mo-stat-card`). Se retiraron `balanceDinero`, `dineroLibre` y `comprasMercancia` de `FinancialSummary`; los fijos pendientes ya no restan, se avisan con `utilidadTrasFijos`.
- **La comparativa de 6 meses usa la misma cuenta.** `MonthlyComparisonRow` suma `costoMercancia`, `ganancia` y `margen`; el costo mensual sale de `ExpenseRepository.getMonthlyProductCostTotals` (una llamada a `get_reinvestment_fund_totals` por mes → `cogs_mes`, sin migración). La gráfica muestra Ventas / Costo + gastos / Ganancia (3 colores); la tabla los separa. El Excel (hoja Comparativa) igual.
- **App iOS:** `pctGastos` y `balance` se conservan en la fila solo por paridad con `owner_finance_summary`, que sigue entregando `balance = entradas − gastos`. Pendiente: agregar `costo_mercancia`/`ganancia` a la `tendencia` de esa RPC y a la app.
