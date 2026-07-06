# Sesión 2026-07-04 — Plan: módulo de Finanzas (gastos del negocio vs. entradas totales)

## Contexto y decisión de scope

El usuario pidió un módulo para manejar **nómina, mantenimiento y gastos del negocio** que ayude a manejar las finanzas.

**Definición central (del usuario):** los gastos de este módulo son **gastos del negocio en relación a las entradas totales**. El entregable principal no es un simple registro de gastos: es la vista financiera **Entradas totales − Gastos = Utilidad neta**, con el peso (%) de cada gasto sobre los ingresos del período.

**Restricciones del usuario (dichas explícitamente en esta sesión):**

1. **NO es un módulo legal/fiscal.** No se emite nómina electrónica DIAN, no se calcula PILA, prestaciones ni seguridad social. Se **simula** lo que hacen los sistemas POS comerciales, sin emitir nada.
2. **La nómina real es simple:** el costo total pagado es **$1.800.000 COP/mes** (acuerdo directo, sin desglose legal). El módulo lo registra como gasto, punto.
3. La visión (`docs/00-vision.md`) ya decía "No reemplaza contabilidad ni nómina" — este módulo respeta eso.

## Investigación: qué hacen los sistemas POS comerciales

- **Loyverse**: "Pay Out" (retiro de caja) para gastos pagados en efectivo, registrado en el historial de caja y reflejado en el reporte de turno.
- **Square / Toast**: nómina como producto aparte integrado por timecards/propinas (overkill para 1-2 empleados).
- **Práctica estándar para negocio pequeño**: pocas categorías generales y consistentes (nómina, arriendo, servicios, mantenimiento, insumos, marketing, otros), cada gasto con fecha/monto/nota, y reporte de utilidad: Ingresos − Costo de ventas − Gastos.

**Conclusión de diseño:** *expense ledger* + *pay-out de caja* + **dashboard financiero ingresos vs. gastos**. Nada de motor de nómina.

## Diseño del módulo `expenses` (Finanzas)

Un solo módulo cubre los tres pedidos: nómina = gasto categoría `nomina` con empleado asociado; mantenimiento = categoría `mantenimiento`; el resto son gastos generales.

### La vista principal: Finanzas del período

Página `/finanzas` (solo admin) con selector de período (mes por defecto, mismos presets de `/reportes`):

```
ENTRADAS TOTALES (ventas completadas del período)        $ X.XXX.XXX
  − Costo de productos vendidos (ya existe utilidadTotal) $ XXX.XXX
  − Gastos del negocio                                    $ X.XXX.XXX
      Nómina          $1.800.000   (XX% de las entradas)
      Arriendo        $  XXX.XXX   (XX%)
      Servicios       $  XXX.XXX   (XX%)
      Mantenimiento   $  XXX.XXX   (XX%)
      Otros…          $  XXX.XXX   (XX%)
  = UTILIDAD NETA                                         $ X.XXX.XXX  (margen %)
```

- Cada categoría muestra su **% sobre entradas totales** — ese ratio es el indicador que el negocio quiere vigilar.
- Comparativa mensual (tabla últimos N meses: entradas, gastos, utilidad neta, margen).
- Debajo: registro/lista de gastos del período (filtro por categoría, anulación con motivo).

### Modelo de datos (migration nueva)

```
empleados
  id uuid pk, tienda_id fk, nombre text, cargo text,
  salario_mensual numeric,            -- 1.800.000 acordado
  activo boolean default true,
  created_at, updated_at

expense_categories (seed fijo + editable por admin)
  id uuid pk, tienda_id fk, nombre text, slug text,
  tipo text check in ('fijo','variable'),
  activo boolean
  -- seed: nomina, arriendo, servicios, mantenimiento,
  --       insumos, marketing, transporte, otros

expenses
  id uuid pk, tienda_id fk,
  category_id fk expense_categories,
  empleado_id fk empleados null,       -- solo gastos de nómina
  concepto text, notas text null,
  monto numeric check > 0,
  fecha_gasto date,
  metodo_pago text check in ('efectivo_caja','efectivo_externo','transferencia','tarjeta'),
  cash_movement_id fk cash_movements null,  -- si salió de la caja abierta
  periodo text null,                   -- 'YYYY-MM' o quincena, para nómina/recurrentes
  status text check in ('active','voided') default 'active',
  voided_by, voided_at, voided_reason, -- no se borra físico (regla del proyecto)
  created_by, created_at

expense_templates (gastos recurrentes)
  id uuid pk, tienda_id fk, category_id fk, empleado_id null,
  concepto text, monto_sugerido numeric,
  frecuencia text check in ('mensual','quincenal'),
  activo boolean
```

Reglas que se mantienen: `tienda_id` en todo, RLS activado, sin borrado físico (anular con auditoría), acceso solo admin (guard por rol existente).

### Comportamientos clave

1. **Registrar gasto** — form (factory + mapper Zod + presenter): categoría, concepto, monto, fecha, método de pago, nota. Si `metodo_pago = 'efectivo_caja'` y hay sesión de caja abierta → crea `cash_movement` tipo egreso vinculado (RPC atómica) para que el cierre de caja siga cuadrando (el "Pay Out" de Loyverse).
2. **Pagar nómina** — flujo corto: elegir empleado → precarga $1.800.000 (o mitad si quincena) → gasto categoría `nomina` con `empleado_id` y `periodo`. Soporta **adelantos** (monto libre con nota); la vista del empleado muestra pagado vs. acordado del mes.
3. **Recurrentes** — botón "Generar gastos del mes" crea borradores desde `expense_templates` (arriendo, servicios, nómina) para confirmar monto real. Sin cron ni automatismos.
4. **Entradas totales** — se leen de las ventas completadas del período vía `ReportsService` (misma fuente del tab Financiero). El módulo no re-agrega ventas; reutiliza la lógica existente.

### Arquitectura (patrones existentes, nada nuevo)

- `src/modules/expenses/` → `domain/` (entidades, `ExpenseRepository` interface, `Result<T,E>`), `dtos/` (Zod), `use-cases/` (`register-expense`, `void-expense`, `pay-employee`, `generate-recurring-drafts`, `build-financial-summary` — cálculo puro de %, utilidad neta y comparativa), `forms/` (factory + mapper).
- `apps/pos-angular/src/app/features/expenses/` → `finanzas.page.ts` (orquestador delgado como `reportes.page.ts`), componentes presentacionales `mo-*` (resumen financiero, tabla % por categoría, lista de gastos, form), `infrastructure/supabase-expense.repository.ts`.
- Ruta `/finanzas` solo admin. Tests unitarios de dominio/DTOs/use-cases obligatorios (en especial `build-financial-summary`).

## Fases de implementación (propuestas como PLAN-47..49)

| ID | Alcance | Tamaño |
|---|---|---|
| PLAN-47 | Migration (4 tablas + RLS + seed categorías) + dominio/DTOs/use-cases + página `/finanzas` con resumen Entradas − Gastos = Utilidad neta (% por categoría) + CRUD de gastos con anulación | L |
| PLAN-48 | Empleados (CRUD mínimo) + flujo "Pagar nómina" (quincena/mes/adelanto) + egreso de caja vinculado (`cash_movement`) | M |
| PLAN-49 | Plantillas recurrentes + "Generar gastos del mes" + comparativa mensual + hoja `Gastos` en el Excel de reportes | M |

Orden: 47 → 48 → 49. Cada uno es un PR independiente. PLAN-47 ya deja valor usable: registrar gastos y ver la relación gastos/entradas del mes.

## Fuera de scope (explícito)

- Nómina electrónica DIAN, PILA, prestaciones, seguridad social, contratos.
- Timecards / control de asistencia.
- Cuentas por pagar con vencimientos (si se necesita, ADR aparte).
- Depreciación de activos, impuestos.

## Resultado de la implementación (misma sesión)

**PLAN-47 y PLAN-48 completos; PLAN-49 parcial.** Verificación: 431 tests pasan (48 archivos), `pnpm typecheck` y build OK, lint sin hallazgos en el módulo nuevo (los 7 errores de lint del repo son preexistentes en otros módulos).

- **Migrations aplicadas al remoto (proyecto Supabase `POS`)**: `20260704_002_expenses_module.sql` (4 tablas + RLS admin-only + seed de 8 categorías por tienda) y `20260704_003_register_expense_atomic.sql` (RPC atómica gasto + egreso de caja; los parámetros opcionales van al final con `default null` para que los tipos generados los marquen opcionales — la primera versión sin defaults rompía el typecheck). Tipos regenerados con `pnpm db:types`.
- **Dominio puro con tests**: `financial-summary.ts` (utilidad neta, % por categoría), `nomina.ts` (pago sugerido por tipo; quincenas suman el salario exacto), `monthly-comparison.ts` (últimos 6 meses).
- **UI `/finanzas` (solo admin, nav "Finanzas")**: KPIs + estado del período + gastos por categoría con % sobre entradas, sección Nómina (empleados, pagado vs. acordado, diálogo de pago con monto precargado), tabla de gastos con anulación (motivo ≥10 chars, reutiliza `mo-void-reason-dialog`), comparativa mensual y navegación por mes.
- **Decisiones**: entradas/costo se leen de `ReportsService.getDailyReport` (DRY con `/reportes`); gasto con `efectivo_caja` exige caja abierta (error amigable si no la hay); `expense_templates` se creó en DB pero su UI quedó pendiente.

## Próximos pasos

1. Commit de todo el módulo (los archivos están sin commitear).
2. Completar PLAN-49: UI de plantillas recurrentes + "Generar gastos del mes" + hoja `Gastos` en el Excel de reportes.
3. QA manual: registrar un gasto con efectivo de caja abierta y verificar que el cierre cuadre.

## Bloqueos / preguntas abiertas

- ¿Cuántos empleados hay hoy? (asumido 1–2; no cambia el diseño).
- ¿Arriendo/servicios se pagan por transferencia o efectivo de caja? (default actual del form: efectivo fuera de caja).
