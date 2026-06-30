import { describe, expect, it } from 'vitest'
import { isLowStock, isOutOfStock } from '@/modules/inventory/domain/services/low-stock'

describe('isLowStock', () => {
  it('prepared con stock 0 y mínimo 0 NO está bajo (bug exacto)', () => {
    expect(isLowStock({ tipo: 'prepared', currentStock: 0, minimumStock: 0 })).toBe(false)
  })

  it('prepared con stock 0 y mínimo 10 NO está bajo', () => {
    expect(isLowStock({ tipo: 'prepared', currentStock: 0, minimumStock: 10 })).toBe(false)
  })

  it('simple con 2 <= 5 está bajo', () => {
    expect(isLowStock({ tipo: 'simple', currentStock: 2, minimumStock: 5 })).toBe(true)
  })

  it('simple con 5 <= 5 está bajo (borde de igualdad)', () => {
    expect(isLowStock({ tipo: 'simple', currentStock: 5, minimumStock: 5 })).toBe(true)
  })

  it('simple con 10 > 5 NO está bajo', () => {
    expect(isLowStock({ tipo: 'simple', currentStock: 10, minimumStock: 5 })).toBe(false)
  })

  it('ingredient con 2 <= 5 está bajo (NO se excluye)', () => {
    expect(isLowStock({ tipo: 'ingredient', currentStock: 2, minimumStock: 5 })).toBe(true)
  })

  it('simple con mínimo 0 y stock 0 está bajo (no se altera la regla)', () => {
    expect(isLowStock({ tipo: 'simple', currentStock: 0, minimumStock: 0 })).toBe(true)
  })
})

describe('isOutOfStock', () => {
  it('prepared con stock 0 NO está agotado', () => {
    expect(isOutOfStock({ tipo: 'prepared', currentStock: 0 })).toBe(false)
  })

  it('simple con stock 0 está agotado', () => {
    expect(isOutOfStock({ tipo: 'simple', currentStock: 0 })).toBe(true)
  })

  it('simple con stock negativo está agotado', () => {
    expect(isOutOfStock({ tipo: 'simple', currentStock: -1 })).toBe(true)
  })

  it('ingredient con stock 1 NO está agotado', () => {
    expect(isOutOfStock({ tipo: 'ingredient', currentStock: 1 })).toBe(false)
  })

  it('simple con stock 1 NO está agotado', () => {
    expect(isOutOfStock({ tipo: 'simple', currentStock: 1 })).toBe(false)
  })
})
