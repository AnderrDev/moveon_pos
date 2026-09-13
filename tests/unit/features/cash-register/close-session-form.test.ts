import { describe, expect, it } from 'vitest'
import {
  closeSessionFormSchema,
  createCloseSessionDefaults,
} from '@angular-app/features/cash-register/presentation/forms/close-session-form.factory'
import { closeSessionFormMapper } from '@angular-app/features/cash-register/presentation/forms/close-session-form.mapper'

describe('createCloseSessionDefaults', () => {
  it('inicia el cierre sin retiro y sin montos contados', () => {
    expect(createCloseSessionDefaults()).toEqual({
      actualCashAmount: 0,
      actualTransferAmount: 0,
      withdrawAtClose: false,
      cashLeftAmount: 0,
      notasCierre: '',
    })
  })

  it('acepta los valores esperados al abrir el diálogo', () => {
    expect(createCloseSessionDefaults({
      actualCashAmount: 480_000,
      actualTransferAmount: 70_000,
      cashLeftAmount: 150_000,
    })).toMatchObject({
      actualCashAmount: 480_000,
      actualTransferAmount: 70_000,
      cashLeftAmount: 150_000,
    })
  })
})

describe('closeSessionFormSchema', () => {
  it('rechaza dejar más efectivo del contado cuando se activa el retiro', () => {
    const result = closeSessionFormSchema.safeParse({
      ...createCloseSessionDefaults(),
      actualCashAmount: 100_000,
      cashLeftAmount: 100_001,
      withdrawAtClose: true,
    })

    expect(result.success).toBe(false)
  })

  it('ignora la relación entre montos mientras el retiro está desactivado', () => {
    const result = closeSessionFormSchema.safeParse({
      ...createCloseSessionDefaults(),
      actualCashAmount: 100_000,
      cashLeftAmount: 150_000,
      withdrawAtClose: false,
    })

    expect(result.success).toBe(true)
  })
})

describe('closeSessionFormMapper', () => {
  it('deja todo el efectivo contado cuando el retiro está desactivado', () => {
    expect(closeSessionFormMapper.toPayload({
      actualCashAmount: 480_000,
      actualTransferAmount: 70_000,
      withdrawAtClose: false,
      cashLeftAmount: 150_000,
      notasCierre: '',
    })).toEqual({
      actualCashAmount: 480_000,
      cashLeftAmount: 480_000,
      actualTransferAmount: 70_000,
      notasCierre: undefined,
    })
  })

  it('usa el efectivo dejado y limpia la nota cuando el retiro está activado', () => {
    expect(closeSessionFormMapper.toPayload({
      actualCashAmount: 480_000,
      actualTransferAmount: 70_000,
      withdrawAtClose: true,
      cashLeftAmount: 150_000,
      notasCierre: '  Retiro de cierre  ',
    })).toEqual({
      actualCashAmount: 480_000,
      cashLeftAmount: 150_000,
      actualTransferAmount: 70_000,
      notasCierre: 'Retiro de cierre',
    })
  })
})
