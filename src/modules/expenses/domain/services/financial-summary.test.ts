import { describe, expect, it } from 'vitest'
import type { Expense, ExpenseCategory } from '../entities/expense.entity'
import { buildFinancialSummary } from './financial-summary'

const TIENDA = 'tienda-1'

function categoria(id: string, nombre: string): ExpenseCategory {
  return { id, tiendaId: TIENDA, nombre, slug: nombre.toLowerCase(), tipo: 'variable', isActive: true }
}

function gasto(overrides: Partial<Expense>): Expense {
  return {
    id: 'g-1',
    tiendaId: TIENDA,
    categoryId: 'cat-otros',
    empleadoId: null,
    concepto: 'Gasto de prueba',
    notas: null,
    monto: 100_000,
    fechaGasto: '2026-07-01',
    metodoPago: 'transferencia',
    cashMovementId: null,
    periodo: null,
    status: 'active',
    voidedReason: null,
    voidedAt: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-07-01T10:00:00Z'),
    ...overrides,
  }
}

const CATEGORIAS = [categoria('cat-nomina', 'Nómina'), categoria('cat-otros', 'Otros')]

describe('buildFinancialSummary', () => {
  it('calcula utilidad neta = entradas − costo − gastos activos', () => {
    const summary = buildFinancialSummary({
      entradasTotales: 10_000_000,
      costoProductosVendidos: 4_000_000,
      gastos: [
        gasto({ id: 'g-1', categoryId: 'cat-nomina', monto: 1_800_000 }),
        gasto({ id: 'g-2', categoryId: 'cat-otros', monto: 200_000 }),
      ],
      categorias: CATEGORIAS,
    })

    expect(summary.gastosTotal).toBe(2_000_000)
    expect(summary.utilidadNeta).toBe(4_000_000)
    expect(summary.margenNeto).toBe(40)
    expect(summary.pctGastosSobreEntradas).toBe(20)
  })

  it('excluye los gastos anulados de todos los totales', () => {
    const summary = buildFinancialSummary({
      entradasTotales: 1_000_000,
      costoProductosVendidos: null,
      gastos: [
        gasto({ id: 'g-1', monto: 300_000 }),
        gasto({ id: 'g-2', monto: 500_000, status: 'voided', voidedReason: 'Registro duplicado' }),
      ],
      categorias: CATEGORIAS,
    })

    expect(summary.gastosTotal).toBe(300_000)
    expect(summary.utilidadNeta).toBe(700_000)
  })

  it('agrupa por categoría con % sobre entradas, ordenado de mayor a menor', () => {
    const summary = buildFinancialSummary({
      entradasTotales: 10_000_000,
      costoProductosVendidos: null,
      gastos: [
        gasto({ id: 'g-1', categoryId: 'cat-otros', monto: 250_000 }),
        gasto({ id: 'g-2', categoryId: 'cat-nomina', monto: 1_800_000 }),
        gasto({ id: 'g-3', categoryId: 'cat-otros', monto: 150_000 }),
      ],
      categorias: CATEGORIAS,
    })

    expect(summary.porCategoria).toEqual([
      { categoryId: 'cat-nomina', nombre: 'Nómina', total: 1_800_000, pctSobreEntradas: 18 },
      { categoryId: 'cat-otros', nombre: 'Otros', total: 400_000, pctSobreEntradas: 4 },
    ])
  })

  it('devuelve porcentajes null cuando no hay entradas (evita división por cero)', () => {
    const summary = buildFinancialSummary({
      entradasTotales: 0,
      costoProductosVendidos: null,
      gastos: [gasto({ monto: 100_000 })],
      categorias: CATEGORIAS,
    })

    expect(summary.pctGastosSobreEntradas).toBeNull()
    expect(summary.margenNeto).toBeNull()
    expect(summary.porCategoria[0].pctSobreEntradas).toBeNull()
    expect(summary.utilidadNeta).toBe(-100_000)
  })

  it('trata costo null como 0 en la utilidad pero lo preserva en la salida', () => {
    const summary = buildFinancialSummary({
      entradasTotales: 1_000_000,
      costoProductosVendidos: null,
      gastos: [],
      categorias: CATEGORIAS,
    })

    expect(summary.costoProductosVendidos).toBeNull()
    expect(summary.utilidadNeta).toBe(1_000_000)
  })

  it('usa "Sin categoría" cuando la categoría del gasto no está en la lista', () => {
    const summary = buildFinancialSummary({
      entradasTotales: 1_000_000,
      costoProductosVendidos: null,
      gastos: [gasto({ categoryId: 'cat-desconocida' })],
      categorias: CATEGORIAS,
    })

    expect(summary.porCategoria[0].nombre).toBe('Sin categoría')
  })
})
