import { describe, expect, it } from 'vitest'
import { buildFixedCommitments } from '@angular-app/features/expenses/domain/services/fixed-commitments'
import type { Empleado, Expense, ExpenseTemplate } from '@angular-app/features/expenses/domain/entities/expense.entity'

const T = 'tienda'
const arriendo: ExpenseTemplate = {
  id: 'tpl-arriendo', tiendaId: T, categoryId: 'cat-arriendo', empleadoId: null,
  concepto: 'Arriendo local', montoSugerido: 2_500_000, frecuencia: 'mensual', isActive: true,
}
const gustavo: Empleado = {
  id: 'emp-1', tiendaId: T, nombre: 'Gustavo', cargo: null, salarioMensual: 1_800_000, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
}
function gasto(o: Partial<Expense>): Expense {
  return {
    id: 'g', tiendaId: T, categoryId: 'cat-otros', empleadoId: null, concepto: 'x', notas: null, monto: 0,
    fechaGasto: '2026-10-05', metodoPago: 'transferencia', cashMovementId: null, periodo: null, status: 'active',
    voidedReason: null, voidedAt: null, createdBy: 'u', createdAt: new Date(), ...o,
  }
}

describe('gastos fijos del mes', () => {
  it('sin pagos, todo está pendiente', () => {
    const c = buildFixedCommitments({ templates: [arriendo], empleados: [gustavo], gastos: [], month: '2026-10' })
    expect(c).toMatchObject({ total: 4_300_000, pagado: 0, pendiente: 4_300_000 })
  })

  it('descuenta lo pagado: arriendo completo y medio salario', () => {
    const c = buildFixedCommitments({
      templates: [arriendo],
      empleados: [gustavo],
      gastos: [
        gasto({ categoryId: 'cat-arriendo', concepto: 'Arriendo local', monto: 2_500_000 }),
        gasto({ empleadoId: 'emp-1', monto: 900_000, periodo: '2026-10-Q1' }),
        gasto({ empleadoId: 'emp-1', monto: 900_000, status: 'voided' }),
        gasto({ empleadoId: 'emp-1', monto: 900_000, fechaGasto: '2026-09-30' }),
      ],
      month: '2026-10',
    })
    expect(c.items.map((i) => [i.concepto, i.pendiente])).toEqual([
      ['Arriendo local', 0],
      ['Nómina — Gustavo', 900_000],
    ])
    expect(c.pendiente).toBe(900_000)
  })

  it('una plantilla quincenal cuenta dos veces al mes; inactivos no cuentan', () => {
    const c = buildFixedCommitments({
      templates: [{ ...arriendo, frecuencia: 'quincenal', montoSugerido: 100_000 }, { ...arriendo, id: 'off', isActive: false }],
      empleados: [{ ...gustavo, isActive: false }],
      gastos: [],
      month: '2026-10',
    })
    expect(c.total).toBe(200_000)
  })
})
