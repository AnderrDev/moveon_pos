/**
 * Clave de idempotencia para una operación crítica (venta, gasto). Se genera
 * UNA vez al iniciar el flujo —no por clic— y se reutiliza en cada reintento,
 * para que el servidor devuelva el registro ya creado en vez de duplicarlo.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
