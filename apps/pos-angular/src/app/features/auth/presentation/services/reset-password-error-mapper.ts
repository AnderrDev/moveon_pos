// Pure mapper: traduce el error crudo de Supabase Auth a un mensaje legible en
// español para el flujo de restablecer contraseña (updateUser). Vive en la
// feature `auth` y NO importa runtime de Angular ni de Supabase (solo
// `import type`), así se testea sin TestBed (mismo patrón que
// login-error-mapper.ts).

import type { AuthError } from '@supabase/supabase-js'

const SAME_PASSWORD_MESSAGE = 'La nueva contraseña no puede ser igual a la anterior'
const WEAK_PASSWORD_MESSAGE = 'La contraseña es demasiado débil. Usa una más segura'
const SESSION_EXPIRED_MESSAGE = 'El enlace expiró. Solicita uno nuevo'
const RATE_LIMIT_MESSAGE = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo'
const CONNECTION_MESSAGE = 'No se pudo conectar. Revisa tu conexión a internet'
const GENERIC_MESSAGE = 'No se pudo actualizar la contraseña. Inténtalo de nuevo'

/**
 * Traduce el error de Supabase Auth a un mensaje para el usuario.
 *
 * Discrimina por `code`/`status` (no por texto inglés) y lee ambos campos de
 * forma defensiva: pueden venir undefined (p. ej. fallos de red antes de tener
 * respuesta HTTP).
 *
 * @param error error tal cual lo devuelve `updateUser`, o `null`.
 */
export function mapResetPasswordError(error: AuthError | null): string {
  if (!error) return GENERIC_MESSAGE

  const code = error.code
  const status = error.status

  if (code === 'same_password') {
    return SAME_PASSWORD_MESSAGE
  }

  if (code === 'weak_password') {
    return WEAK_PASSWORD_MESSAGE
  }

  // Sesión de recuperación ausente/expirada: el enlace del correo ya no es
  // válido. Supabase puede reportarlo por code (`session_not_found`) o por
  // status de autorización (401/403).
  if (code === 'session_not_found' || status === 401 || status === 403) {
    return SESSION_EXPIRED_MESSAGE
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
