import { describe, expect, it } from 'vitest'
import { valueStockAtCost } from '@angular-app/features/inventory/domain/services/stock-valuation'
import { fundBalanceKind } from '@angular-app/features/expenses/domain/services/reinvestment-fund'

describe('valor del inventario al costo', () => {
  const products = [
    { id: 'whey', tipo: 'simple' as const, costo: 193000 },
    { id: 'vaso', tipo: 'ingredient' as const, costo: 500 },
    { id: 'batido', tipo: 'prepared' as const, costo: 9000 },
    { id: 'nuevo', tipo: 'simple' as const, costo: null },
    { id: 'negativo', tipo: 'simple' as const, costo: 1000 },
  ]

  it('suma stock total × costo de los productos con stock propio', () => {
    const levels = [
      { productId: 'whey', totalStock: 3 },
      { productId: 'vaso', totalStock: 100 },
      { productId: 'batido', totalStock: 50 },
      { productId: 'nuevo', totalStock: 4 },
      { productId: 'negativo', totalStock: -2 },
      { productId: 'borrado', totalStock: 10 },
    ]
    expect(valueStockAtCost(levels, products)).toEqual({ valorAlCosto: 3 * 193000 + 100 * 500, productosSinCosto: 1 })
  })
})

describe('lectura del saldo del fondo', () => {
  it('negativo es inventario de más, no deuda', () => {
    expect(fundBalanceKind(-10_795_993)).toBe('overinvested')
    expect(fundBalanceKind(250_000)).toBe('available')
    expect(fundBalanceKind(0)).toBe('even')
  })
})
