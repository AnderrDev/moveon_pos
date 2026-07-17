import { inject, Injectable } from '@angular/core'
import { z } from 'zod'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import { SessionService } from '../../core/auth/session.service'
import { AuditLogRepository } from '../audit/audit-log.repository'
import { err, ok, type Result } from '@/shared/result'
import { mapSaleError } from './sale-error-mapper'
import type { PaymentEntry } from './pos.types'
import type { PosCartItem } from './pos-cart.store'
import type { CartTotals } from '@/modules/sales/domain/services/sale-calculator'

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
  /** Canjes MOVE ON Club: recompensa → producto del carrito al que se aplica. */
  loyaltyRedemptions?: { rewardId: string; productId: string }[]
}

export interface CreatePosSaleResult {
  saleId: string
}

export type CreatePosSaleError =
  | { kind: 'unauthenticated' }
  | { kind: 'validation'; message: string }
  | { kind: 'remote'; message: string }

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

const rpcInputSchema = z.object({
  cashSessionId: z.string().uuid('Sesión de caja inválida'),
  idempotencyKey: z.string().min(1, 'idempotency_key faltante'),
  clienteId: z.string().uuid('Cliente inválido').nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        nombre: z.string().min(1),
        sku: z.string().nullable().optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        discountAmount: z.number().nonnegative(),
        ivaTasa: z.number().nonnegative(),
        taxAmount: z.number().nonnegative(),
        total: z.number().nonnegative(),
      })
    )
    .min(1, 'La venta necesita al menos un ítem'),
  payments: z
    .array(
      z.object({
        metodo: z.enum(['cash', 'card', 'transfer', 'other']),
        amount: z.number().positive(),
        referencia: z.string().nullable().optional(),
      })
    )
    .min(1, 'Se requiere al menos un pago'),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    discountTotal: z.number().nonnegative(),
    taxTotal: z.number().nonnegative(),
    total: z.number().positive(),
  }),
  globalDiscountTotal: z.number().nonnegative(),
  discountReason: z.string().trim().min(3, 'Escribe el motivo del descuento').nullable(),
  loyaltyRedemptions: z
    .array(
      z.object({
        rewardId: z.string().uuid('Recompensa inválida'),
        productId: z.string().uuid(),
      })
    )
    .default([]),
})

@Injectable({ providedIn: 'root' })
export class PosSaleService {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly sessionService = inject(SessionService)
  private readonly audit = inject(AuditLogRepository)

  async createSale(
    input: CreatePosSaleInput
  ): Promise<Result<CreatePosSaleResult, CreatePosSaleError>> {
    const auth = await this.sessionService.getAuthContext()
    if (!auth) return err({ kind: 'unauthenticated' })

    const parsed = rpcInputSchema.safeParse({
      cashSessionId: input.cashSessionId,
      idempotencyKey: input.idempotencyKey,
      clienteId: input.clienteId,
      items: input.items,
      payments: input.payments,
      totals: input.totals,
      globalDiscountTotal: input.globalDiscountTotal,
      discountReason: input.discountReason,
      loyaltyRedemptions: input.loyaltyRedemptions ?? [],
    })
    if (!parsed.success) {
      return err({
        kind: 'validation',
        message: parsed.error.issues[0]?.message ?? 'Datos de venta inválidos',
      })
    }

    // El RPC identifica la línea canjeada por índice (0-based) dentro de p_items.
    const loyaltyRedemptions = (input.loyaltyRedemptions ?? []).map((redemption) => {
      const itemIndex = input.items.findIndex((item) => item.productId === redemption.productId)
      return { reward_id: redemption.rewardId, item_index: itemIndex }
    })
    if (loyaltyRedemptions.some((redemption) => redemption.item_index < 0)) {
      return err({
        kind: 'validation',
        message: 'El producto del canje ya no está en el carrito',
      })
    }

    const rpcClient = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await rpcClient.rpc<string>('create_sale_atomic', {
      p_tienda_id: auth.tiendaId,
      p_cash_session_id: input.cashSessionId,
      // El sale_number lo genera create_sale_atomic (correlativo por tienda).
      // Se envía un placeholder porque la firma del RPC lo exige, pero el RPC lo ignora.
      p_sale_number: '',
      p_cashier_id: auth.userId,
      p_cliente_id: input.clienteId,
      p_subtotal: input.totals.subtotal,
      p_discount_total: input.totals.discountTotal,
      p_tax_total: input.totals.taxTotal,
      p_total: input.totals.total,
      p_idempotency_key: input.idempotencyKey,
      p_items: input.items.map((item) => ({
        producto_id: item.productId,
        producto_nombre: item.nombre,
        producto_sku: item.sku ?? null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount,
        tax_rate: item.ivaTasa,
        tax_amount: item.taxAmount,
        total: item.total,
      })),
      p_payments: input.payments.map((payment) => ({
        metodo: payment.metodo,
        amount: payment.amount,
        referencia: payment.referencia ?? null,
      })),
      p_global_discount_total: input.globalDiscountTotal,
      p_discount_reason: input.discountReason,
      p_loyalty_redemptions: loyaltyRedemptions.length > 0 ? loyaltyRedemptions : null,
    })

    if (error) {
      // postgrest-js (sin `.throwOnError()`) devuelve `error` como objeto plano
      // `{ message, ... }`, NO una instancia de Error. Por eso se lee `error.message`
      // directo en vez de `getErrorMessage` (que solo extrae de Error/string y
      // descartaría el texto del RPC). El RPC emite cadenas crudas (ej. 'Stock
      // insuficiente'); el mapper las traduce a un mensaje legible y, para stock,
      // reconstruye el detalle desde el carrito. El RPC sigue siendo la autoridad
      // ante carreras de stock.
      const rawMessage = error.message?.trim() ? error.message : 'Error al crear venta'
      return err({ kind: 'remote', message: mapSaleError(rawMessage, input.items) })
    }
    if (!data) return err({ kind: 'remote', message: 'Venta creada sin id de respuesta' })

    void this.audit.log({
      tiendaId: auth.tiendaId,
      entityType: 'venta',
      entityId: data,
      action: 'create',
      changes: { total: input.totals.total, items: input.items.length, payments: input.payments.map((p) => p.metodo) },
    })

    return ok({ saleId: data })
  }
}
