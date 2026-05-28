import { describe, expect, it } from 'vitest'
import {
  createResetPasswordFormDefaults,
  resetPasswordFormSchema,
} from '@/modules/auth/forms/reset-password-form.factory'
import { resetPasswordFormMapper } from '@/modules/auth/forms/reset-password-form.mapper'

describe('resetPasswordFormSchema', () => {
  it('acepta una contraseña de 6+ caracteres con confirmación igual', () => {
    const result = resetPasswordFormSchema.safeParse({
      password: 'Nueva1234!',
      confirmPassword: 'Nueva1234!',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza contraseñas con menos de 6 caracteres', () => {
    expect(
      resetPasswordFormSchema.safeParse({ password: '123', confirmPassword: '123' }).success,
    ).toBe(false)
  })

  it('rechaza cuando password y confirmPassword no coinciden, con el issue en confirmPassword', () => {
    const result = resetPasswordFormSchema.safeParse({
      password: 'Nueva1234!',
      confirmPassword: 'Otra1234!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const mismatch = result.error.issues.find(
        (issue) => issue.path.length === 1 && issue.path[0] === 'confirmPassword',
      )
      expect(mismatch).toBeDefined()
      expect(mismatch?.path).toEqual(['confirmPassword'])
    }
  })
})

describe('createResetPasswordFormDefaults', () => {
  it('devuelve los campos vacíos por defecto', () => {
    expect(createResetPasswordFormDefaults()).toEqual({ password: '', confirmPassword: '' })
  })

  it('respeta overrides parciales', () => {
    expect(createResetPasswordFormDefaults({ password: 'x' })).toEqual({
      password: 'x',
      confirmPassword: '',
    })
  })
})

describe('resetPasswordFormMapper', () => {
  it('envía solo la nueva contraseña en el payload', () => {
    expect(
      resetPasswordFormMapper.toUpdatePayload({
        password: 'Nueva1234!',
        confirmPassword: 'Nueva1234!',
      }),
    ).toEqual({ password: 'Nueva1234!' })
  })
})
