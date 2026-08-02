import { describe, it, expect } from 'vitest'
import type { AuthError } from '@supabase/supabase-js'
import { mapResetPasswordError } from '@angular-app/features/auth/presentation/services/reset-password-error-mapper'

const authError = (parts: Partial<AuthError>): AuthError => parts as AuthError

describe('mapResetPasswordError', () => {
  it('mapea same_password a un mensaje específico en español', () => {
    const result = mapResetPasswordError(authError({ code: 'same_password', status: 422 }))
    expect(result).toBe('La nueva contraseña no puede ser igual a la anterior')
  })

  it('mapea weak_password a un mensaje de contraseña débil', () => {
    const result = mapResetPasswordError(authError({ code: 'weak_password', status: 422 }))
    expect(result).toBe('La contraseña es demasiado débil. Usa una más segura')
  })

  it('mapea sesión expirada por code session_not_found', () => {
    const result = mapResetPasswordError(authError({ code: 'session_not_found', status: 404 }))
    expect(result).toBe('El enlace expiró. Solicita uno nuevo')
  })

  it('mapea sesión expirada por status 401', () => {
    const result = mapResetPasswordError(authError({ status: 401 }))
    expect(result).toBe('El enlace expiró. Solicita uno nuevo')
  })

  it('mapea sesión expirada por status 403', () => {
    const result = mapResetPasswordError(authError({ status: 403 }))
    expect(result).toBe('El enlace expiró. Solicita uno nuevo')
  })

  it('mapea el rate limit (status 429)', () => {
    const result = mapResetPasswordError(authError({ status: 429 }))
    expect(result).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo')
  })

  it('mapea fallo de red (sin status) al mensaje de conexión', () => {
    const result = mapResetPasswordError(authError({ status: undefined, message: 'Failed to fetch' }))
    expect(result).toBe('No se pudo conectar. Revisa tu conexión a internet')
  })

  it('cae al genérico ante un fallo inesperado con status definido', () => {
    const result = mapResetPasswordError(authError({ code: 'unexpected_failure', status: 500 }))
    expect(result).toBe('No se pudo actualizar la contraseña. Inténtalo de nuevo')
  })

  it('devuelve el genérico cuando el error es null', () => {
    expect(mapResetPasswordError(null)).toBe(
      'No se pudo actualizar la contraseña. Inténtalo de nuevo',
    )
  })
})
