import { describe, expect, it } from 'vitest'
import type { ExpenseTemplate } from '../entities/expense.entity'
import { templateStatusForMonth } from './recurrentes'

function template(overrides: Partial<ExpenseTemplate>): ExpenseTemplate {
  return {
    id: 't-1',
    tiendaId: 'tienda-1',
    categoryId: 'cat-arriendo',
    empleadoId: null,
    concepto: 'Arriendo local',
    montoSugerido: 1_500_000,
    frecuencia: 'mensual',
    isActive: true,
    ...overrides,
  }
}

describe('templateStatusForMonth', () => {
  it('marca registrado cuando hay un gasto activo del mes con mismo concepto y categoría', () => {
    const status = templateStatusForMonth(
      [template({}), template({ id: 't-2', concepto: 'Internet', categoryId: 'cat-servicios' })],
      [
        {
          categoryId: 'cat-arriendo',
          concepto: 'Arriendo local',
          periodo: '2026-07',
          status: 'active',
        },
      ],
      '2026-07',
    )
    expect(status).toHaveLength(2)
    expect(status[0].registrado).toBe(true)
    expect(status[1].registrado).toBe(false)
  })

  it('ignora gastos anulados, de otro mes o sin período', () => {
    const gastoBase = { categoryId: 'cat-arriendo', concepto: 'Arriendo local' }
    const status = templateStatusForMonth(
      [template({})],
      [
        { ...gastoBase, periodo: '2026-07', status: 'voided' },
        { ...gastoBase, periodo: '2026-06', status: 'active' },
        { ...gastoBase, periodo: null, status: 'active' },
      ],
      '2026-07',
    )
    expect(status[0].registrado).toBe(false)
  })

  it('cuenta pagos quincenales para su mes y excluye plantillas inactivas', () => {
    const status = templateStatusForMonth(
      [
        template({}),
        template({ id: 't-inactiva', concepto: 'Vieja suscripción', isActive: false }),
      ],
      [
        {
          categoryId: 'cat-arriendo',
          concepto: 'Arriendo local',
          periodo: '2026-07-Q1',
          status: 'active',
        },
      ],
      '2026-07',
    )
    expect(status).toHaveLength(1)
    expect(status[0].registrado).toBe(true)
  })
})
