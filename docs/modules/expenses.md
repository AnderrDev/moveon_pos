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

## Datos (migrations `20260704_002` y `20260704_003`)

- `empleados` — nombre, cargo, `salario_mensual` (costo total acordado), `is_active`.
- `expense_categories` — seed por tienda: nomina, arriendo, servicios, mantenimiento, insumos, marketing, transporte, otros (`tipo` fijo/variable, editable).
- `expenses` — categoría, empleado opcional, concepto, monto, `fecha_gasto` (date local), `metodo_pago` (`efectivo_caja|efectivo_externo|transferencia|tarjeta`), `cash_movement_id`, `periodo`, status + campos de anulación.
- `expense_templates` — plantillas recurrentes de gastos fijos. Son **configuración**, no registros transaccionales: borrado físico permitido (mismo criterio que clientes).
- RPC `register_expense_atomic(...)` — security invoker, parámetros opcionales con `default null`.

## Estructura

```
src/modules/expenses/
  domain/entities/expense.entity.ts        Expense, ExpenseCategory, Empleado, ExpenseTemplate
  domain/repositories/expense.repository.ts  contrato (impl. en Angular)
  domain/services/financial-summary.ts     buildFinancialSummary (núcleo, puro + tests)
  domain/services/nomina.ts                buildNominaPagoSugerido, pagadoPorEmpleado (+ tests)
  domain/services/monthly-comparison.ts    lastMonths, buildMonthlyComparison (+ tests)
  application/dtos/expense.dto.ts          createExpenseSchema, voidExpenseSchema (Zod)
  application/dtos/empleado.dto.ts         saveEmpleadoSchema
  application/use-cases/register-expense.use-case.ts   Result<Expense, {code:'validation'}>
  application/use-cases/void-expense.use-case.ts
  forms/expense-form.{factory,mapper}.ts   patrón 3 archivos
  forms/empleado-form.{factory,mapper}.ts
  forms/nomina-pago-form.{factory,mapper}.ts

apps/pos-angular/src/app/features/expenses/
  finanzas.page.ts                orquestador (mes visible, carga, diálogos)
  expenses.repository.ts          impl. Supabase del contrato del dominio
  expense-form.presenter.ts       presenter Zod del form de gasto
  expense-form.dialog.ts          registrar gasto
  empleado-form.dialog.ts         crear/editar empleado
  nomina-pago.dialog.ts           pagar nómina (precarga por tipo)
  financial-summary.component.ts  KPIs + estado del período + % por categoría (presentacional)
  nomina-section.component.ts     empleados con pagado vs. acordado (presentacional)
  expense-list.component.ts       tabla de gastos con anulación (presentacional)
  monthly-comparison.component.ts últimos 6 meses (presentacional)
```

## Recurrentes y export (PLAN-49)

- **"Gastos del mes"** (`recurrentes.dialog.ts`): lista las plantillas activas cruzadas con los gastos del mes visible (`templateStatusForMonth`, dominio puro). "Registrar" abre el form de gasto **prellenado** (categoría/concepto/monto) con `periodo = mes visible`; al guardarse, la plantilla pasa a "Registrado este mes". Coincidencia por concepto + categoría + período (las quincenas cuentan para su mes).
- **Export Excel** desde `/finanzas` (`expense-export.ts`): hojas `Resumen` (estado del período + % por categoría), `Gastos` (incluye anulados con motivo) y `Comparativa`. Se exporta desde el módulo con datos ya cargados (ADR 0011) — no se tocó el Excel de `/reportes`.

## Limitaciones conocidas

- La comparativa mensual usa `entradas − gastos` sin costo de productos (cargar 6 meses de `sale_items` sería pesado; anotado en la UI).
- Probado end-to-end en Chrome contra producción (2026-07-05): CRUD de gastos, nómina, plantillas, export y guards de rol. Ver `docs/sessions/2026-07-05-finanzas-cierre-plan49.md`.
