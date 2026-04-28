export function formatCurrency(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
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
