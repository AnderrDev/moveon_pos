import { describe, expect, it } from 'vitest'
import {
  createForgotPasswordFormDefaults,
  forgotPasswordFormSchema,
} from '@angular-app/features/auth/presentation/forms/forgot-password-form.factory'
import { forgotPasswordFormMapper } from '@angular-app/features/auth/presentation/forms/forgot-password-form.mapper'

describe('forgotPasswordFormSchema', () => {
  it('acepta un correo válido y lo normaliza con trim', () => {
    const result = forgotPasswordFormSchema.safeParse({ email: '  admin@moveonpos.co  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('admin@moveonpos.co')
  })

  it('rechaza un correo vacío', () => {
    expect(forgotPasswordFormSchema.safeParse({ email: '' }).success).toBe(false)
  })

  it('rechaza un correo inválido', () => {
    expect(forgotPasswordFormSchema.safeParse({ email: 'admin' }).success).toBe(false)
  })
})

describe('createForgotPasswordFormDefaults', () => {
  it('devuelve el email vacío por defecto', () => {
    expect(createForgotPasswordFormDefaults()).toEqual({ email: '' })
  })

  it('respeta overrides parciales', () => {
    expect(createForgotPasswordFormDefaults({ email: 'foo@bar.co' })).toEqual({
      email: 'foo@bar.co',
    })
  })
})

describe('forgotPasswordFormMapper', () => {
  it('normaliza el email a minúsculas y sin espacios', () => {
    expect(
      forgotPasswordFormMapper.toResetRequest({ email: '  ADMIN@MOVEONPOS.CO  ' }),
    ).toEqual({ email: 'admin@moveonpos.co' })
  })
})
