import { describe, it, expect } from 'vitest'
// Pure predicate extracted to role-policy.ts so it runs in node without TestBed.
import { canCorrectPayment } from '../../../../../apps/pos-angular/src/app/core/auth/role-policy'

describe('canCorrectPayment', () => {
  it('permite corregir el método de pago a admin', () => {
    expect(canCorrectPayment('admin')).toBe(true)
  })

  it('niega corregir el método de pago a cajero', () => {
    expect(canCorrectPayment('cajero')).toBe(false)
  })

  it('niega corregir el método de pago cuando no hay rol (null)', () => {
    expect(canCorrectPayment(null)).toBe(false)
  })
})
