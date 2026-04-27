import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('devuelve valores por defecto de login', () => {
    const defaults = createLoginFormDefaults()
    expect(defaults).toHaveProperty('email')
    expect(defaults).toHaveProperty('password')
  })

  it('precarga credenciales en development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(createLoginFormDefaults()).toEqual({
      email: 'admin@moveonpos.co',
      password: 'Admin1234!',
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
