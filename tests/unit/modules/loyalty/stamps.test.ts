import { describe, expect, it } from 'vitest'
import {
  applyLoyaltyDiscountToItem,
  applyStampCycles,
  countEligibleStampUnits,
  isRewardExpired,
  rewardDiscountForPrice,
} from '@/modules/loyalty/domain/services/stamps'

describe('countEligibleStampUnits', () => {
  it('cuenta 1 sello por unidad de producto participante sin descuento (RN-LF01)', () => {
    expect(
      countEligibleStampUnits([
        { participaFidelizacion: true, quantity: 3, discountAmount: 0 },
        { participaFidelizacion: true, quantity: 1, discountAmount: 0 },
      ]),
    ).toBe(4)
  })

  it('excluye productos que no participan (RN-LF06)', () => {
    expect(
      countEligibleStampUnits([{ participaFidelizacion: false, quantity: 5, discountAmount: 0 }]),
    ).toBe(0)
  })

  it('excluye líneas con descuento manual (RN-LF02)', () => {
    expect(
      countEligibleStampUnits([{ participaFidelizacion: true, quantity: 2, discountAmount: 1000 }]),
    ).toBe(0)
  })

  it('la unidad canjeada no genera sello, las demás de la línea sí (RN-LF05)', () => {
    expect(
      countEligibleStampUnits([
        { participaFidelizacion: true, quantity: 3, discountAmount: 0, hasRedemption: true },
      ]),
    ).toBe(2)
  })

  it('una línea canjeada de 1 unidad no genera sellos y nunca resta', () => {
    expect(
      countEligibleStampUnits([
        { participaFidelizacion: true, quantity: 1, discountAmount: 0, hasRedemption: true },
      ]),
    ).toBe(0)
  })

  it('trunca cantidades fraccionarias hacia abajo', () => {
    expect(
      countEligibleStampUnits([{ participaFidelizacion: true, quantity: 2.5, discountAmount: 0 }]),
    ).toBe(2)
  })
})

describe('applyStampCycles', () => {
  it('ejemplo oficial del negocio: 7 sellos + 3 batidos = 1 recompensa y quedan 2 (RN-LF07)', () => {
    expect(applyStampCycles(7, 3, 8)).toEqual({ rewardsGenerated: 1, balanceAfter: 2 })
  })

  it('una compra grande puede generar más de una recompensa', () => {
    expect(applyStampCycles(6, 18, 8)).toEqual({ rewardsGenerated: 3, balanceAfter: 0 })
  })

  it('sin cruzar el umbral no genera recompensa', () => {
    expect(applyStampCycles(3, 4, 8)).toEqual({ rewardsGenerated: 0, balanceAfter: 7 })
  })

  it('llegar exacto al umbral genera la recompensa y deja el saldo en 0', () => {
    expect(applyStampCycles(0, 8, 8)).toEqual({ rewardsGenerated: 1, balanceAfter: 0 })
  })
})

describe('isRewardExpired', () => {
  const now = new Date('2026-07-14T12:00:00Z')

  it('vigente cuando expires_at es futuro (RN-LF09)', () => {
    expect(isRewardExpired(new Date('2026-07-15T12:00:00Z'), now)).toBe(false)
  })

  it('vencida cuando expires_at ya pasó', () => {
    expect(isRewardExpired(new Date('2026-07-14T11:59:59Z'), now)).toBe(true)
  })

  it('vencida en el instante exacto del límite', () => {
    expect(isRewardExpired(new Date('2026-07-14T12:00:00Z'), now)).toBe(true)
  })
})

describe('rewardDiscountForPrice', () => {
  it('batido base de $11.000 queda gratis (RN-LF08)', () => {
    expect(rewardDiscountForPrice(11_000, 11_000)).toBe(11_000)
  })

  it('batido con leche de $13.000: cubre $11.000 y el cliente paga $2.000', () => {
    expect(rewardDiscountForPrice(13_000, 11_000)).toBe(11_000)
  })

  it('batido más barato que la recompensa: cubre solo el precio, sin devolver dinero (RN-LF11)', () => {
    expect(rewardDiscountForPrice(9_000, 11_000)).toBe(9_000)
  })
})

describe('applyLoyaltyDiscountToItem', () => {
  const item = {
    ivaTasa: 0,
    descuentoTotal: 0,
    baseImponible: 13_000,
    taxAmount: 0,
    total: 13_000,
  }

  it('aplica el descuento una sola vez a la línea, no por unidad', () => {
    const adjusted = applyLoyaltyDiscountToItem({ ...item, total: 26_000, baseImponible: 26_000 }, 11_000)
    expect(adjusted.total).toBe(15_000)
    expect(adjusted.descuentoTotal).toBe(11_000)
  })

  it('recalcula el IVA incluido después del canje', () => {
    const conIva = { ivaTasa: 19, descuentoTotal: 0, baseImponible: 10_924, taxAmount: 2_076, total: 13_000 }
    const adjusted = applyLoyaltyDiscountToItem(conIva, 11_000)
    expect(adjusted.total).toBe(2_000)
    expect(adjusted.baseImponible).toBe(Math.round(2_000 / 1.19))
    expect(adjusted.taxAmount).toBe(adjusted.total - adjusted.baseImponible)
  })

  it('nunca deja el total en negativo', () => {
    const adjusted = applyLoyaltyDiscountToItem({ ...item, total: 9_000, baseImponible: 9_000 }, 11_000)
    expect(adjusted.total).toBe(0)
    expect(adjusted.descuentoTotal).toBe(9_000)
  })

  it('descuento 0 devuelve el ítem sin cambios', () => {
    expect(applyLoyaltyDiscountToItem(item, 0)).toBe(item)
  })
})
