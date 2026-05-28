// Pure mapper: traduce el error crudo de Supabase Auth a un mensaje legible en
// español para el login. Vive en la feature `auth` y NO importa runtime de
// Angular ni de Supabase (solo `import type`), así se testea sin TestBed (mismo
// patrón que sale-error-mapper.ts).
//
// Regla de seguridad: ante credenciales inválidas el mensaje es genérico y NO
// revela si falló el email o la contraseña.

import type { AuthError } from '@supabase/supabase-js'

const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos'
const EMAIL_NOT_CONFIRMED_MESSAGE = 'Debes confirmar tu correo antes de ingresar'
const RATE_LIMIT_MESSAGE = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo'
const GENERIC_MESSAGE = 'No se pudo iniciar sesión. Inténtalo de nuevo'
const CONNECTION_MESSAGE = 'No se pudo conectar. Revisa tu conexión a internet'

const INVALID_CREDENTIALS_RAW = 'Invalid login credentials'

/**
 * Traduce el error de Supabase Auth a un mensaje para el usuario.
 *
 * Discrimina por `code`/`status` (no por texto inglés) y lee ambos campos de
 * forma defensiva: pueden venir undefined (p. ej. fallos de red antes de tener
 * respuesta HTTP).
 *
 * @param error error tal cual lo devuelve `signInWithPassword`, o `null`.
 */
export function mapLoginError(error: AuthError | null): string {
  if (!error) return GENERIC_MESSAGE

  const code = error.code
  const status = error.status
  const message = error.message ?? ''

  if (code === 'invalid_credentials' || (status === 400 && message.includes(INVALID_CREDENTIALS_RAW))) {
    return INVALID_CREDENTIALS_MESSAGE
  }

  if (code === 'email_not_confirmed') {
    return EMAIL_NOT_CONFIRMED_MESSAGE
  }

  if (code === 'over_request_rate_limit' || status === 429) {
    return RATE_LIMIT_MESSAGE
  }

  // Sin `status` definido = no hubo respuesta HTTP (red caída / fetch falló).
  if (status === undefined) {
    return CONNECTION_MESSAGE
  }

  return GENERIC_MESSAGE
}
