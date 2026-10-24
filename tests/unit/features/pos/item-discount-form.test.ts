import { describe, expect, it } from 'vitest'
import {
  createItemDiscountDefaults,
  createItemDiscountFormSchema,
} from '@angular-app/features/pos/presentation/forms/item-discount-form.factory'
import { itemDiscountFormMapper } from '@angular-app/features/pos/presentation/forms/item-discount-form.mapper'

const UNIT_PRICE = 120_000

describe('descuento por producto', () => {
  it('abre en pesos con el descuento actual de la línea', () => {
    expect(itemDiscountFormMapper.toFormValue({ discountAmount: 5_000 })).toEqual({
      discountMode: 'amount',
      discountAmount: 5_000,
      discountPercent: 0,
    })
  })

  it('convierte entre pesos y porcentaje sin perder el monto', () => {
    const amount = { ...createItemDiscountDefaults(), discountAmount: 12_000 }
    const percent = itemDiscountFormMapper.switchMode(amount, 'percent', UNIT_PRICE)
    expect(percent.discountPercent).toBe(10)
    expect(itemDiscountFormMapper.toDiscountAmount({ ...percent, discountPercent: 25 }, UNIT_PRICE)).toBe(30_000)
    const back = itemDiscountFormMapper.switchMode({ ...percent, discountPercent: 25 }, 'amount', UNIT_PRICE)
    expect(back).toMatchObject({ discountMode: 'amount', discountAmount: 30_000 })
  })

  it('no deja superar el precio unitario y marca el campo visible', () => {
    const schema = createItemDiscountFormSchema(UNIT_PRICE)
    const over = schema.safeParse({ ...createItemDiscountDefaults(), discountAmount: 120_001 })
    expect(over.success ? null : over.error.issues[0]).toMatchObject({
      path: ['discountAmount'],
      message: 'El descuento no puede superar el precio unitario',
    })
    const pct = schema.safeParse({ discountMode: 'percent', discountAmount: 0, discountPercent: 101 })
    expect(pct.success ? null : pct.error.issues.map((i) => i.message)).toContain('El porcentaje no puede superar 100')
    expect(schema.safeParse({ ...createItemDiscountDefaults(), discountAmount: 120_000 }).success).toBe(true)
  })
})
