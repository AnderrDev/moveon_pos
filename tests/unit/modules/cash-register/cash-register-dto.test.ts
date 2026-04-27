import { describe, expect, it } from 'vitest'
import {
  addMovementSchema,
  closeSessionSchema,
  openSessionSchema,
} from '@/modules/cash-register/application/dtos/cash-register.dto'

describe('openSessionSchema', () => {
  it('acepta monto de apertura en cero', () => {
    expect(openSessionSchema.safeParse({ openingAmount: 0 }).success).toBe(true)
  })

  it('rechaza monto de apertura negativo', () => {
    expect(openSessionSchema.safeParse({ openingAmount: -1 }).success).toBe(false)
  })
})

describe('addMovementSchema', () => {
  it('acepta movimientos de caja válidos', () => {
    const result = addMovementSchema.safeParse({
      tipo: 'cash_out',
      amount: 10000,
      motivo: 'Compra de bolsas',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza montos en cero', () => {
    const result = addMovementSchema.safeParse({
      tipo: 'cash_in',
      amount: 0,
      motivo: 'Ingreso manual',
    })
    expect(result.success).toBe(false)
  })

  it('requiere motivo mínimo', () => {
    const result = addMovementSchema.safeParse({
      tipo: 'expense',
      amount: 5000,
      motivo: 'ok',
    })
    expect(result.success).toBe(false)
  })
})

describe('closeSessionSchema', () => {
  it('acepta cierre con efectivo contado', () => {
    expect(closeSessionSchema.safeParse({ actualCashAmount: 50000 }).success).toBe(true)
  })

  it('rechaza conteo negativo', () => {
    expect(closeSessionSchema.safeParse({ actualCashAmount: -1000 }).success).toBe(false)
  })
})
