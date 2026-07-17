/**
 * Normalización de celulares colombianos (RN-CL05).
 *
 * Forma canónica: 10 dígitos empezando por 3, sin prefijo internacional.
 * Acepta entradas con `+57`, `57`, espacios, guiones, paréntesis y puntos.
 * Es la única fuente de verdad de normalización: la usan el registro de
 * clientes, la búsqueda por celular y el índice único `celular_normalizado`.
 */

const CELL_CO = /^3\d{9}$/

export function normalizePhoneCO(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (CELL_CO.test(digits)) return digits
  if (digits.length === 12 && digits.startsWith('57') && CELL_CO.test(digits.slice(2))) {
    return digits.slice(2)
  }
  return null
}

export function isValidPhoneCO(input: string): boolean {
  return normalizePhoneCO(input) !== null
}

/** Formato visible para UI: `300 123 4567`. Devuelve la entrada si no es normalizable. */
export function formatPhoneCO(input: string): string {
  const normalized = normalizePhoneCO(input)
  if (!normalized) return input
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`
}
