import { describe, it, expect } from 'vitest'
import type { AuthError } from '@supabase/supabase-js'
import { mapLoginError } from '../../../../../apps/pos-angular/src/app/features/auth/login-error-mapper'

const authError = (parts: Partial<AuthError>): AuthError => parts as AuthError

describe('mapLoginError', () => {
  it('mapea credenciales inválidas por code a un mensaje genérico en español', () => {
    const result = mapLoginError(
      authError({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }),
    )
    expect(result).toBe('Email o contraseña incorrectos')
  })

  it('mapea credenciales inválidas por status+texto cuando falta el code', () => {
    const result = mapLoginError(
      authError({ code: undefined, status: 400, message: 'Invalid login credentials' }),
    )
    expect(result).toBe('Email o contraseña incorrectos')
  })

  it('mapea correo sin confirmar', () => {
    const result = mapLoginError(authError({ code: 'email_not_confirmed', status: 400 }))
    expect(result).toBe('Debes confirmar tu correo antes de ingresar')
  })

  it('mapea el rate limit', () => {
    const result = mapLoginError(authError({ code: 'over_request_rate_limit', status: 429 }))
    expect(result).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo')
  })

  it('cae al genérico ante un fallo inesperado con status definido', () => {
    const result = mapLoginError(authError({ code: 'unexpected_failure', status: 500 }))
    expect(result).toBe('No se pudo iniciar sesión. Inténtalo de nuevo')
  })

  it('mapea fallo de red (sin status) al mensaje de conexión', () => {
    const result = mapLoginError(authError({ status: undefined, message: 'Failed to fetch' }))
    expect(result).toBe('No se pudo conectar. Revisa tu conexión a internet')
  })

  it('devuelve el genérico cuando el error es null', () => {
    const result = mapLoginError(null)
    expect(result).toBe('No se pudo iniciar sesión. Inténtalo de nuevo')
  })
})
