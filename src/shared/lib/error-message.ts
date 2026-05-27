/**
 * Extrae un mensaje legible de cualquier `unknown` lanzado.
 *
 * Patrón estándar para reemplazar `error instanceof Error ? error.message : '...'`
 * que se repetía en >20 sitios.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}
