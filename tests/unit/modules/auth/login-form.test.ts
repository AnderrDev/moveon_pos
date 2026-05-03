import { describe, expect, it } from 'vitest'
import {
  createLoginFormDefaults,
  loginFormSchema,
} from '@/modules/auth/forms/login-form.factory'
import { loginFormMapper } from '@/modules/auth/forms/login-form.mapper'

describe('loginFormSchema', () => {
  it('acepta credenciales válidas', () => {
    const result = loginFormSchema.safeParse({
      email: ' admin@moveonpos.co ',
      password: 'Admin1234!',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('admin@moveonpos.co')
  })

  it('rechaza correos inválidos', () => {
    expect(loginFormSchema.safeParse({ email: 'admin', password: 'Admin1234!' }).success).toBe(false)
  })

  it('rechaza contraseñas cortas', () => {
    expect(loginFormSchema.safeParse({ email: 'admin@moveonpos.co', password: '123' }).success).toBe(false)
  })
})

describe('createLoginFormDefaults', () => {
  it('devuelve campos vacíos por defecto', () => {
    expect(createLoginFormDefaults()).toEqual({ email: '', password: '' })
  })

  it('respeta overrides parciales (útiles para presenters Angular en local)', () => {
    expect(createLoginFormDefaults({ email: 'foo@bar.co' })).toEqual({
      email: 'foo@bar.co',
      password: '',
    })
  })
})

describe('loginFormMapper', () => {
  it('normaliza email para sign in', () => {
    expect(loginFormMapper.toSignInPayload({
      email: ' ADMIN@MOVEONPOS.CO ',
      password: 'Admin1234!',
    })).toEqual({
      email: 'admin@moveonpos.co',
      password: 'Admin1234!',
    })
  })
})
