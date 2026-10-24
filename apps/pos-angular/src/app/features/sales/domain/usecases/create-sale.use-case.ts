import { err, ok, type Result } from '@/shared/result'
import type { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { createSaleSchema } from '@angular-app/features/sales/domain/dtos/sale.dto'

export interface CreateSaleDeps {
  repo: Pick<SaleRepository, 'create'>
  tiendaId: string
  cashierId: string
}

export type CreateSaleError =
  | { kind: 'validation'; message: string }
  /** La RPC rechazó la venta (stock, caja cerrada, descuento no autorizado…). Mensaje crudo. */
  | { kind: 'remote'; message: string }

/**
 * Valida y registra una venta del POS. La RPC `create_sale_atomic` sigue
 * siendo la autoridad (stock, caja abierta, umbral de descuento, canjes);
 * este use-case valida la forma y resuelve cada canje a la línea a la que
 * se aplica antes de persistir.
 *
 * A diferencia de los demás use-cases de ventas, un rechazo de la RPC vuelve
 * como `Result` (`remote`) y no como `throw`: para el cajero "stock
 * insuficiente" es un resultado esperado del cobro, no un fallo técnico.
 */
export async function createSale(
  deps: CreateSaleDeps,
  input: unknown,
): Promise<Result<{ saleId: string }, CreateSaleError>> {
  const parsed = createSaleSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      kind: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de venta inválidos',
    })
  }

  const { loyaltyRedemptions, ...sale } = parsed.data

  // La RPC identifica la línea canjeada por índice (0-based) dentro de los
  // ítems. Se busca por `key` (producto + opción), no por producto.
  const redemptions = loyaltyRedemptions.map((redemption) => ({
    rewardId: redemption.rewardId,
    itemIndex: sale.items.findIndex((item) => item.key === redemption.itemKey),
  }))
  if (redemptions.some((redemption) => redemption.itemIndex < 0)) {
    return err({ kind: 'validation', message: 'El producto del canje ya no está en el carrito' })
  }

  try {
    const saleId = await deps.repo.create({
      ...sale,
      tiendaId: deps.tiendaId,
      cashierId: deps.cashierId,
      loyaltyRedemptions: redemptions,
    })
    return ok({ saleId })
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : 'Error al crear venta'
    return err({ kind: 'remote', message })
  }
}
