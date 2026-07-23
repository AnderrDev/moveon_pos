import { describe, it, expect } from 'vitest'
import { canCorrectSaleCustomer } from '@angular-app/core/auth/role-policy'

describe('canCorrectSaleCustomer', () => {
  it('permite asociar retroactivamente un cliente a admin', () => {
    expect(canCorrectSaleCustomer('admin')).toBe(true)
  })

  it('niega asociar retroactivamente un cliente a cajero', () => {
    expect(canCorrectSaleCustomer('cajero')).toBe(false)
  })

  it('niega asociar retroactivamente un cliente cuando no hay rol (null)', () => {
    expect(canCorrectSaleCustomer(null)).toBe(false)
  })
})
