import { describe, it, expect } from 'vitest'
// Pure predicate extracted to role-policy.ts so it runs in node without TestBed.
import { canVoidSale } from '../../../../../apps/pos-angular/src/app/core/auth/role-policy'

describe('canVoidSale', () => {
  it('permite anular a admin', () => {
    expect(canVoidSale('admin')).toBe(true)
  })

  it('niega anular a cajero', () => {
    expect(canVoidSale('cajero')).toBe(false)
  })

  it('niega anular a contexto sin rol (null)', () => {
    expect(canVoidSale(null)).toBe(false)
  })
})
