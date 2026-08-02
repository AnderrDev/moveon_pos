import type { Expense, ExpenseTemplate } from '@angular-app/features/expenses/domain/entities/expense.entity'

export interface TemplateStatus {
  template: ExpenseTemplate
  /** true si ya existe un gasto activo del mes que coincide con la plantilla. */
  registrado: boolean
}

/**
 * Cruza las plantillas recurrentes con los gastos del mes (`YYYY-MM`) para
 * saber cuáles ya se registraron. Coincidencia: mismo concepto y misma
 * categoría en un gasto activo cuyo `periodo` cae en el mes (las quincenas
 * `YYYY-MM-Q1/Q2` cuentan para su mes).
 */
export function templateStatusForMonth(
  templates: readonly ExpenseTemplate[],
  gastos: readonly Pick<Expense, 'categoryId' | 'concepto' | 'periodo' | 'status'>[],
  month: string,
): TemplateStatus[] {
  const delMes = gastos.filter(
    (g) => g.status === 'active' && g.periodo !== null && g.periodo.startsWith(month),
  )
  return templates
    .filter((t) => t.isActive)
    .map((template) => ({
      template,
      registrado: delMes.some(
        (g) => g.categoryId === template.categoryId && g.concepto === template.concepto,
      ),
    }))
}
