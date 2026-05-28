export function formatCurrency(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Parser puro de moneda en pesos colombianos (enteros, sin decimales).
 *
 * Extrae únicamente los dígitos de cualquier representación de entrada
 * (tipeo, paste, autofill, `fill()` de Playwright, set programmático) y
 * los reinterpreta como un entero. El `.` es separador de miles, no decimal,
 * así que se descarta como cualquier otro caracter no numérico (incluido el
 * NBSP que produce `Intl` en es-CO).
 *
 * Garantías:
 * - Nunca devuelve `NaN`.
 * - Entrada vacía o sin dígitos → `0`.
 *
 * @example parseCurrency('$ 2.533.560') // 2533560
 * @example parseCurrency('') // 0
 * @example parseCurrency('abc') // 0
 */
export function parseCurrency(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits === '') return 0
  return Number.parseInt(digits, 10)
}

/**
 * Restringe un valor al rango `[min, max]`. Usado por los inputs de moneda
 * para mantener la UX consistente (p. ej. tope al precio unitario en descuentos)
 * sin reemplazar a Zod como fuente de validación.
 */
export function clampCurrency(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function formatTime(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const value = typeof date === 'string' ? new Date(date) : date
  return value.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

export function formatShortDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date
  return value.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}
