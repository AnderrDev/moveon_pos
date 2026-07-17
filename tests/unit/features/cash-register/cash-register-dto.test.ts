import { describe, expect, it } from 'vitest'
import {
  addMovementSchema,
  closeSessionSchema,
  correctOpeningSchema,
  openSessionSchema,
  voidMovementSchema,
} from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

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

describe('voidMovementSchema', () => {
  const movementId = '11111111-1111-1111-1111-111111111111'

  it('acepta un motivo de anulación válido', () => {
    const result = voidMovementSchema.safeParse({
      movementId,
      reason: 'Registrado por error, se revierte',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza un motivo demasiado corto', () => {
    const result = voidMovementSchema.safeParse({ movementId, reason: 'corto' })
    expect(result.success).toBe(false)
  })

  it('rechaza un movementId que no es UUID', () => {
    const result = voidMovementSchema.safeParse({
      movementId: 'no-es-uuid',
      reason: 'Registrado por error, se revierte',
    })
    expect(result.success).toBe(false)
  })
})

describe('closeSessionSchema', () => {
  it('acepta cierre con efectivo contado', () => {
    expect(closeSessionSchema.safeParse({ actualCashAmount: 50000 }).success).toBe(true)
  })

  it('acepta cierre con confirmacion por medios de pago', () => {
    const result = closeSessionSchema.safeParse({
      actualCashAmount:     50000,
      actualCardAmount:     30000,
      actualTransferAmount: 40000,
      actualOtherAmount:    0,
    })

    expect(result.success).toBe(true)
  })

  it('rechaza conteo negativo', () => {
    expect(closeSessionSchema.safeParse({ actualCashAmount: -1000 }).success).toBe(false)
  })

  it('rechaza confirmaciones digitales negativas', () => {
    const result = closeSessionSchema.safeParse({
      actualCashAmount: 50000,
      actualCardAmount: -1,
    })

    expect(result.success).toBe(false)
  })
})

describe('correctOpeningSchema', () => {
  const sessionId = '22222222-2222-2222-2222-222222222222'

  it('acepta una corrección válida', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId,
      newAmount: 150000,
      reason: 'Se digitó mal el monto de apertura del turno',
    })
    expect(result.success).toBe(true)
  })

  it('acepta un nuevo monto en cero', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId,
      newAmount: 0,
      reason: 'Se abrió la caja sin efectivo inicial por error',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza un monto negativo', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId,
      newAmount: -1000,
      reason: 'Se digitó mal el monto de apertura del turno',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza un motivo demasiado corto', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId,
      newAmount: 150000,
      reason: 'corto',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza cuando falta newAmount', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId,
      reason: 'Se digitó mal el monto de apertura del turno',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza cuando newAmount no es numérico', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId,
      newAmount: 'mucho',
      reason: 'Se digitó mal el monto de apertura del turno',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza un sessionId que no es UUID', () => {
    const result = correctOpeningSchema.safeParse({
      sessionId: 'no-es-uuid',
      newAmount: 150000,
      reason: 'Se digitó mal el monto de apertura del turno',
    })
    expect(result.success).toBe(false)
  })
})
