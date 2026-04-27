'use client'

interface FormErrorProps {
  message?: string
}

/**
 * Muestra el error raíz del formulario (errores del servidor).
 * Úsalo junto con form.setError('root', { message: '...' })
 *
 * Uso:
 *   <FormError message={form.formState.errors.root?.message} />
 */
export function FormError({ message }: FormErrorProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  )
}
