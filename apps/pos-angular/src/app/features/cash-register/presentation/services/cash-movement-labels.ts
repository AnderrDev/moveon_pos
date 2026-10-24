import type { CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'

/** Etiqueta en español del tipo de movimiento de caja. */
export function cashMovementLabel(tipo: string): string {
  if (tipo === 'cash_in') return 'Entrada'
  if (tipo === 'cash_out') return 'Retiro'
  if (tipo === 'expense') return 'Gasto'
  if (tipo === 'correction') return 'Correccion'
  return tipo
}

export function cashMovementBadge(mov: CashMovement): 'success' | 'warning' | 'destructive' | 'default' {
  if (mov.tipo === 'cash_in') return 'success'
  if (mov.tipo === 'cash_out') return 'warning'
  if (mov.tipo === 'expense') return 'destructive'
  return 'default'
}
