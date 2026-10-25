import type {
  Empleado,
  Expense,
  ExpenseTemplate,
} from '@angular-app/features/expenses/domain/entities/expense.entity'

/**
 * Gastos fijos del mes (arriendo, servicios, nómina...): lo que hay que pagar
 * sí o sí, pagado o no. Lo pendiente se aparta del dinero disponible desde
 * el día 1 aunque todavía no se haya registrado el gasto. Función pura.
 *
 * - Plantillas activas: mensual = monto sugerido; quincenal = 2 × monto.
 *   Pagado = gastos activos del mes con la misma categoría y concepto.
 * - Empleados activos: salario mensual. Pagado = gastos activos del mes
 *   ligados al empleado (pagos y adelantos de nómina).
 */
export interface FixedCommitment {
  key: string
  concepto: string
  tipo: 'plantilla' | 'nomina'
  monto: number
  pagado: number
  pendiente: number
}

export interface FixedCommitments {
  items: FixedCommitment[]
  total: number
  pagado: number
  pendiente: number
}

function inMonth(gasto: Pick<Expense, 'fechaGasto' | 'periodo'>, month: string): boolean {
  return gasto.fechaGasto.startsWith(month) || (gasto.periodo?.startsWith(month) ?? false)
}

export function buildFixedCommitments(input: {
  templates: readonly ExpenseTemplate[]
  empleados: readonly Empleado[]
  gastos: readonly Expense[]
  /** `YYYY-MM` */
  month: string
}): FixedCommitments {
  const delMes = input.gastos.filter((g) => g.status === 'active' && inMonth(g, input.month))

  const items: FixedCommitment[] = []

  for (const template of input.templates) {
    if (!template.isActive) continue
    const monto = template.frecuencia === 'quincenal' ? template.montoSugerido * 2 : template.montoSugerido
    const pagado = delMes
      .filter((g) => g.categoryId === template.categoryId && g.concepto === template.concepto)
      .reduce((sum, g) => sum + g.monto, 0)
    items.push({
      key: `tpl:${template.id}`,
      concepto: template.concepto,
      tipo: 'plantilla',
      monto,
      pagado,
      pendiente: Math.max(0, monto - pagado),
    })
  }

  for (const empleado of input.empleados) {
    if (!empleado.isActive || empleado.salarioMensual <= 0) continue
    const pagado = delMes.filter((g) => g.empleadoId === empleado.id).reduce((sum, g) => sum + g.monto, 0)
    items.push({
      key: `emp:${empleado.id}`,
      concepto: `Nómina — ${empleado.nombre}`,
      tipo: 'nomina',
      monto: empleado.salarioMensual,
      pagado,
      pendiente: Math.max(0, empleado.salarioMensual - pagado),
    })
  }

  return {
    items,
    total: items.reduce((s, i) => s + i.monto, 0),
    pagado: items.reduce((s, i) => s + Math.min(i.pagado, i.monto), 0),
    pendiente: items.reduce((s, i) => s + i.pendiente, 0),
  }
}
