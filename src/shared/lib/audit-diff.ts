/**
 * Cambios de una edición para la auditoría: solo los campos que de verdad
 * cambiaron, con su valor anterior y el nuevo (`{ campo: { from, to } }`).
 * Antes se guardaban todos los valores nuevos y no se podía saber qué se
 * modificó. Función pura.
 */
export type AuditFieldChange = { from: unknown; to: unknown }

function normalize(value: unknown): unknown {
  if (value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function sameValue(a: unknown, b: unknown): boolean {
  const left = normalize(a)
  const right = normalize(b)
  if (left === right) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

export function auditDiff<T extends object>(
  before: T,
  after: T,
  fields: readonly (keyof T)[],
): Record<string, AuditFieldChange> {
  const changes: Record<string, AuditFieldChange> = {}
  for (const field of fields) {
    const from = before[field]
    const to = after[field]
    if (!sameValue(from, to)) {
      changes[String(field)] = { from: normalize(from), to: normalize(to) }
    }
  }
  return changes
}
