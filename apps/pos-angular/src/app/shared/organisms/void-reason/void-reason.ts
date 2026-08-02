// Pure void-reason helper extracted from the sales-history dialog so it can be
// unit-tested in a node environment without Angular TestBed/jsdom (mismo patrón
// que stock-cap.ts / role-policy.ts).

/**
 * Longitud mínima del motivo de anulación (tras recortar espacios).
 *
 * RN-I03: toda anulación de venta exige un motivo auditable; 10 caracteres es el
 * mínimo que obliga a escribir una justificación real y no un "ok"/"err".
 */
export const VOID_REASON_MIN_LENGTH = 10

/**
 * Indica si un motivo de anulación es válido.
 *
 * Aplica `.trim()` antes de medir, de modo que un texto compuesto solo por
 * espacios nunca pasa y los espacios al inicio/fin no inflan la longitud.
 * El límite es inclusivo: exactamente `VOID_REASON_MIN_LENGTH` caracteres es válido.
 */
export function isValidVoidReason(reason: string): boolean {
  return reason.trim().length >= VOID_REASON_MIN_LENGTH
}
