import { describe, it, expect } from 'vitest'
import { capQuantity } from '../../../../../apps/pos-angular/src/app/features/pos/stock-cap'

describe('capQuantity', () => {
  it('respeta lo solicitado cuando es menor al máximo', () => {
    expect(capQuantity(3, 8)).toEqual({ quantity: 3, capped: false })
  })

  it('topa al máximo cuando lo solicitado lo supera', () => {
    expect(capQuantity(9, 8)).toEqual({ quantity: 8, capped: true })
  })

  it('no topa cuando lo solicitado es igual al máximo', () => {
    expect(capQuantity(8, 8)).toEqual({ quantity: 8, capped: false })
  })

  it('no topa cuando max es null (producto sin rastreo, ej. prepared)', () => {
    expect(capQuantity(50, null)).toEqual({ quantity: 50, capped: false })
  })

  it('con max=0 no se puede agregar: devuelve 0 y capped true', () => {
    // Documentación: la página NO debe insertar el ítem cuando quantity llega a 0.
    expect(capQuantity(1, 0)).toEqual({ quantity: 0, capped: true })
  })
})
