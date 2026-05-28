import { describe, it, expect } from 'vitest'
import {
  buildPaymentEntry,
  requiresReference,
} from '@/modules/sales/domain/services/sale-builder'

describe('requiresReference', () => {
  it('efectivo no requiere referencia', () => {
    expect(requiresReference('cash')).toBe(false)
  })

  it('métodos no-efectivo admiten referencia', () => {
    expect(requiresReference('card')).toBe(true)
    expect(requiresReference('nequi')).toBe(true)
    expect(requiresReference('daviplata')).toBe(true)
    expect(requiresReference('transfer')).toBe(true)
    expect(requiresReference('other')).toBe(true)
  })
})

describe('buildPaymentEntry', () => {
  it('descarta la referencia en pagos en efectivo', () => {
    const result = buildPaymentEntry({ metodo: 'cash', amount: 50000, referencia: 'ABC123' })
    expect(result).toEqual({ metodo: 'cash', amount: 50000 })
    expect(result?.referencia).toBeUndefined()
  })

  it('recorta la referencia (trim) en métodos no-efectivo', () => {
    const result = buildPaymentEntry({ metodo: 'nequi', amount: 50000, referencia: '  ABC123  ' })
    expect(result).toEqual({ metodo: 'nequi', amount: 50000, referencia: 'ABC123' })
  })

  it('normaliza referencia vacía a undefined', () => {
    const result = buildPaymentEntry({ metodo: 'nequi', amount: 50000, referencia: '' })
    expect(result).toEqual({ metodo: 'nequi', amount: 50000 })
    expect(result?.referencia).toBeUndefined()
  })

  it('normaliza referencia de solo espacios a undefined', () => {
    const result = buildPaymentEntry({ metodo: 'nequi', amount: 50000, referencia: '   ' })
    expect(result).toEqual({ metodo: 'nequi', amount: 50000 })
    expect(result?.referencia).toBeUndefined()
  })

  it('conserva la referencia válida con amount > 0 (card)', () => {
    const result = buildPaymentEntry({ metodo: 'card', amount: 119000, referencia: 'XXXX' })
    expect(result).toEqual({ metodo: 'card', amount: 119000, referencia: 'XXXX' })
  })

  it('retorna null cuando amount es 0', () => {
    expect(buildPaymentEntry({ metodo: 'card', amount: 0, referencia: 'XXXX' })).toBeNull()
  })

  it('retorna null cuando amount es negativo', () => {
    expect(buildPaymentEntry({ metodo: 'cash', amount: -5000 })).toBeNull()
  })

  it('retorna null cuando amount no es entero', () => {
    expect(buildPaymentEntry({ metodo: 'cash', amount: 100.5 })).toBeNull()
  })
})
