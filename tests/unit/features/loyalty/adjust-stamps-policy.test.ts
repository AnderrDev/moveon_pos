import { describe, expect, it } from 'vitest'
import { canAdjustLoyaltyStamps } from '@angular-app/core/auth/role-policy'

describe('permiso de ajuste manual de sellos', () => {
  it('permite a admin y cajero, y rechaza una sesión sin rol', () => {
    expect(canAdjustLoyaltyStamps('admin')).toBe(true)
    expect(canAdjustLoyaltyStamps('cajero')).toBe(true)
    expect(canAdjustLoyaltyStamps(null)).toBe(false)
  })
})
