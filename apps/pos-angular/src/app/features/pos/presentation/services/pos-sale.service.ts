import { inject, Injectable } from '@angular/core'
import { SessionService } from '@angular-app/core/auth/session.service'
import { err, ok, type Result } from '@/shared/result'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { createSale } from '@angular-app/features/sales/domain/usecases/create-sale.use-case'
import { mapSaleError } from '@angular-app/features/pos/presentation/services/sale-error-mapper'
import type { PaymentEntry } from '@angular-app/features/pos/presentation/services/pos.types'
import type { PosCartItem } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import type { CartTotals } from '@angular-app/features/sales/domain/services/sale-calculator'

export interface CreatePosSaleInput {
  cashSessionId: string
  idempotencyKey: string
  clienteId: string | null
  items: PosCartItem[]
  payments: PaymentEntry[]
  totals: CartTotals
  globalDiscountTotal: number
  discountReason: string | null
  change: number
  /** Canjes MOVE ON Club: recompensa → línea del carrito a la que se aplica. */
  loyaltyRedemptions?: { rewardId: string; itemKey: string }[]
}

export interface CreatePosSaleResult {
  saleId: string
}

export type CreatePosSaleError =
  | { kind: 'unauthenticated' }
  | { kind: 'validation'; message: string }
  | { kind: 'remote'; message: string }

/**
 * Adaptador del POS hacia el use-case `createSale` (sales/domain): traduce el
 * carrito al contrato de dominio y el rechazo de la RPC a un mensaje legible.
 * No conoce Supabase; la persistencia vive en `SaleRepository`.
 */
@Injectable({ providedIn: 'root' })
export class PosSaleService {
  private readonly sessionService = inject(SessionService)
  private readonly saleRepo = inject(SaleRepository)

  async createSale(
    input: CreatePosSaleInput
  ): Promise<Result<CreatePosSaleResult, CreatePosSaleError>> {
    const auth = await this.sessionService.getAuthContext()
    if (!auth) return err({ kind: 'unauthenticated' })

    const result = await createSale(
      { repo: this.saleRepo, tiendaId: auth.tiendaId, cashierId: auth.userId },
      {
        cashSessionId: input.cashSessionId,
        idempotencyKey: input.idempotencyKey,
        clienteId: input.clienteId,
        items: input.items.map((item) => ({
          key: item.key,
          productId: item.productId,
          nombre: item.nombre,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          optionId: item.option?.id ?? null,
          discountAmount: item.discountAmount,
          taxRate: item.ivaTasa,
          taxAmount: item.taxAmount,
          total: item.total,
        })),
        payments: input.payments,
        totals: input.totals,
        globalDiscountTotal: input.globalDiscountTotal,
        discountReason: input.discountReason,
        loyaltyRedemptions: input.loyaltyRedemptions ?? [],
      },
    )

    if (!result.ok) {
      // El mapper traduce el texto crudo de la RPC y, para stock, reconstruye
      // el detalle desde el carrito. La RPC sigue siendo la autoridad ante
      // carreras de stock.
      return result.error.kind === 'remote'
        ? err({ kind: 'remote', message: mapSaleError(result.error.message, input.items) })
        : err(result.error)
    }
    return ok({ saleId: result.value.saleId })
  }
}
