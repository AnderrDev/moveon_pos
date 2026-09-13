import { describe, expect, it } from 'vitest'
import {
  getStampsRemaining,
  selectFeaturedLoyaltyProgress,
} from '@angular-app/features/loyalty/domain/services/customer-progress'
import type { LoyaltyCustomerProgress } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'

const progress = (
  clienteId: string,
  stampsBalance: number,
  availableRewards = 0
): LoyaltyCustomerProgress => ({ clienteId, stampsBalance, availableRewards })

describe('customer loyalty progress', () => {
  it('calcula los sellos faltantes con el umbral configurado', () => {
    expect(getStampsRemaining(6, 10)).toBe(4)
    expect(getStampsRemaining(10, 10)).toBe(0)
  })

  it('destaca primero a quien ya tiene un premio disponible', () => {
    const featured = selectFeaturedLoyaltyProgress([progress('cerca', 7), progress('premio', 1, 1)])

    expect(featured?.clienteId).toBe('premio')
  })

  it('destaca el mayor saldo cuando nadie tiene premio disponible', () => {
    const featured = selectFeaturedLoyaltyProgress([
      progress('tres', 3),
      progress('siete', 7),
      progress('cinco', 5),
    ])

    expect(featured?.clienteId).toBe('siete')
  })

  it('no destaca a nadie cuando todos están en cero', () => {
    expect(selectFeaturedLoyaltyProgress([progress('uno', 0), progress('dos', 0)])).toBeNull()
  })
})
