import type { FieldErrors, FieldValues } from 'react-hook-form'

/**
 * Devuelve el primer mensaje de error del formulario.
 * Útil para mostrar una notificación toast cuando el submit falla.
 *
 * Uso:
 *   const firstError = formErrorResolver(form.formState.errors)
 *   if (firstError) toast.error(firstError)
 */
export function formErrorResolver<TValues extends FieldValues>(
  errors: FieldErrors<TValues>,
): string | null {
  for (const key of Object.keys(errors)) {
    const error = errors[key as keyof typeof errors]
    if (!error) continue

    if (typeof error.message === 'string') return error.message

    if (typeof error === 'object' && !('message' in error)) {
      const nested = formErrorResolver(error as FieldErrors<FieldValues>)
      if (nested) return nested
    }
  }
  return null
}
