import { describe, expect, it } from 'vitest'
import {
  adjustStampsFormSchema,
  createAdjustStampsFormDefaults,
} from '@angular-app/features/loyalty/presentation/forms/adjust-stamps-form.factory'
import { adjustStampsFormMapper } from '@angular-app/features/loyalty/presentation/forms/adjust-stamps-form.mapper'

const CTX = {
  tiendaId: 'tienda-1',
  clienteId: 'cliente-1',
  createdBy: 'user-1',
}

describe('adjustStampsFormSchema', () => {
  it('acepta un ajuste positivo con motivo', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: 2, reason: 'venta sin registrar' })
    expect(result.success).toBe(true)
  })

  it('acepta un ajuste negativo', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: -3, reason: 'corrección de error' })
    expect(result.success).toBe(true)
  })

  it('rechaza delta cero (RN-LF16)', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: 0, reason: 'motivo válido' })
    expect(result.success).toBe(false)
  })

  it('rechaza delta no numérico (input vacío)', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: Number.NaN, reason: 'motivo' })
    expect(result.success).toBe(false)
  })

  it('rechaza delta decimal', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: 1.5, reason: 'motivo válido' })
    expect(result.success).toBe(false)
  })

  it('rechaza motivo de menos de 3 caracteres (RN-LF16)', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: 1, reason: '  ab  ' })
    expect(result.success).toBe(false)
  })

  it('trimmea el motivo', () => {
    const result = adjustStampsFormSchema.safeParse({ delta: 1, reason: '  compensación  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBe('compensación')
  })

  it('rechaza ajustes fuera de ±99', () => {
    expect(adjustStampsFormSchema.safeParse({ delta: 100, reason: 'motivo' }).success).toBe(false)
    expect(adjustStampsFormSchema.safeParse({ delta: -100, reason: 'motivo' }).success).toBe(false)
  })
})

describe('createAdjustStampsFormDefaults', () => {
  it('inicia vacío (delta null, motivo vacío)', () => {
    expect(createAdjustStampsFormDefaults()).toEqual({ delta: null, reason: '' })
  })
})

describe('adjustStampsFormMapper', () => {
  it('arma el payload del RPC con el contexto de sesión', () => {
    const payload = adjustStampsFormMapper.toPayload({ delta: 2, reason: 'compensación' }, CTX)
    expect(payload).toEqual({
      tiendaId: 'tienda-1',
      clienteId: 'cliente-1',
      delta: 2,
      reason: 'compensación',
      createdBy: 'user-1',
    })
  })
})
