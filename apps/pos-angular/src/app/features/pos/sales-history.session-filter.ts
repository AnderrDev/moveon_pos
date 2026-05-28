import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

/**
 * Selecciona las ventas que pertenecen a la sesión de caja indicada.
 *
 * "Ventas del turno" = ventas de la `cash_session` abierta actual. El repositorio
 * ya filtra por `cash_session_id` + `tienda_id`; esta función pura es una segunda
 * barrera en el cliente para garantizar que:
 * - sin sesión (`cashSessionId === null`) el listado arranque vacío;
 * - nunca se incluyan ventas de otra `cash_session` aunque vengan en `sales`.
 */
export function selectSessionSales(sales: Sale[], cashSessionId: string | null): Sale[] {
  if (!cashSessionId) return []
  return sales.filter((s) => s.cashSessionId === cashSessionId)
}
