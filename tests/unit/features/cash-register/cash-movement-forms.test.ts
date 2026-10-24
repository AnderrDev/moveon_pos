import { describe, expect, it } from 'vitest'
import {
  addMovementFormSchema,
  createAddMovementDefaults,
} from '@angular-app/features/cash-register/presentation/forms/add-movement-form.factory'
import { addMovementFormMapper } from '@angular-app/features/cash-register/presentation/forms/add-movement-form.mapper'
import { correctMovementFormSchema } from '@angular-app/features/cash-register/presentation/forms/correct-movement-form.factory'
import { correctMovementFormMapper } from '@angular-app/features/cash-register/presentation/forms/correct-movement-form.mapper'
import { correctOpeningFormSchema } from '@angular-app/features/cash-register/presentation/forms/correct-opening-form.factory'
import { correctOpeningFormMapper } from '@angular-app/features/cash-register/presentation/forms/correct-opening-form.mapper'
import { openSessionFormSchema } from '@angular-app/features/cash-register/presentation/forms/open-session-form.factory'
import { openSessionFormMapper } from '@angular-app/features/cash-register/presentation/forms/open-session-form.mapper'
import type { CashMovement, CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'

const messages = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))

describe('abrir caja', () => {
  it('parte de la sugerencia del último cierre y rechaza negativos', () => {
    expect(openSessionFormMapper.toFormValue(150_000)).toEqual({ openingAmount: 150_000 })
    expect(openSessionFormMapper.toFormValue(null)).toEqual({ openingAmount: 0 })
    expect(messages(openSessionFormSchema.safeParse({ openingAmount: -1 }))).toEqual({
      openingAmount: 'El monto de apertura no puede ser negativo',
    })
  })
})

describe('movimiento de caja', () => {
  it('usa el tipo inicial y exige monto y motivo', () => {
    const defaults = createAddMovementDefaults({ tipo: 'expense' })
    expect(defaults).toEqual({ tipo: 'expense', amount: 0, motivo: '' })
    expect(messages(addMovementFormSchema.safeParse(defaults))).toEqual({
      amount: 'El monto debe ser mayor a 0',
      motivo: 'Describe el motivo',
    })
  })

  it('recorta el motivo antes de aplicar el mínimo del DTO', () => {
    expect(addMovementFormSchema.safeParse({ tipo: 'cash_in', amount: 1000, motivo: '  a  ' }).success).toBe(false)
    const parsed = addMovementFormSchema.parse({ tipo: 'cash_in', amount: 1000, motivo: '  Base extra ' })
    expect(addMovementFormMapper.toPayload(parsed)).toEqual({ tipo: 'cash_in', amount: 1000, motivo: 'Base extra' })
  })
})

describe('corregir movimiento y apertura', () => {
  const movement = { id: 'm1', amount: 20_000, motivo: 'Base adicional' } as CashMovement
  const session = { id: 's1', openingAmount: 125_000 } as CashSession

  it('arrancan con lo registrado y el motivo vacío', () => {
    expect(correctMovementFormMapper.toFormValue(movement)).toEqual({ newAmount: 20_000, newMotivo: 'Base adicional', reason: '' })
    expect(correctOpeningFormMapper.toFormValue(session)).toEqual({ newAmount: 125_000, reason: '' })
  })

  it('exigen el motivo mínimo de auditoría y agregan el id al enviar', () => {
    expect(messages(correctMovementFormSchema.safeParse({ newAmount: 1, newMotivo: 'Vasos', reason: 'corto' }))).toEqual({
      reason: 'El motivo de la corrección debe tener al menos 10 caracteres',
    })
    const value = correctOpeningFormSchema.parse({ newAmount: 100_000, reason: ' Conteo inicial mal digitado ' })
    expect(correctOpeningFormMapper.toPayload(value, 's1')).toEqual({
      sessionId: 's1',
      newAmount: 100_000,
      reason: 'Conteo inicial mal digitado',
    })
  })
})
