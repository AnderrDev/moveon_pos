import { inject, Injectable } from '@angular/core'
import { z } from 'zod'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import { SessionService } from '../../core/auth/session.service'
import { err, ok, type Result } from '@/shared/result'
import { getErrorMessage } from '@/shared/lib/error-message'
import type { PaymentEntry } from './pos.types'
import type { PosCartItem } from './pos-cart.store'
import type { CartTotals } from '@/modules/sales/domain/services/sale-calculator'

export interface CreatePosSaleInput {
  cashSessionId: string
  idempotencyKey: string
  items: PosCartItem[]
  payments: PaymentEntry[]
  totals: CartTotals
  change: number
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
      }),
    )
    .min(1, 'La venta necesita al menos un ítem'),
  payments: z
    .array(
      z.object({
        metodo: z.enum(['cash', 'card', 'nequi', 'daviplata', 'transfer', 'other']),
        amount: z.number().positive(),
        referencia: z.string().nullable().optional(),
      }),
    )
    .min(1, 'Se requiere al menos un pago'),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    discountTotal: z.number().nonnegative(),
    taxTotal: z.number().nonnegative(),
    total: z.number().positive(),
  }),
})

function createSaleNumber(now = new Date()): string {
  const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `${prefix}-${String(now.getTime())}`
}

@Injectable({ providedIn: 'root' })
export class PosSaleService {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly sessionService = inject(SessionService)

  async createSale(
    input: CreatePosSaleInput,
  ): Promise<Result<CreatePosSaleResult, CreatePosSaleError>> {
    const auth = await this.sessionService.getAuthContext()
    if (!auth) return err({ kind: 'unauthenticated' })

    const parsed = rpcInputSchema.safeParse({
      cashSessionId: input.cashSessionId,
      idempotencyKey: input.idempotencyKey,
      items: input.items,
      payments: input.payments,
      totals: input.totals,
    })
    if (!parsed.success) {
      return err({
        kind: 'validation',
        message: parsed.error.issues[0]?.message ?? 'Datos de venta inválidos',
      })
    }

    const rpcClient = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await rpcClient.rpc<string>('create_sale_atomic', {
      p_tienda_id: auth.tiendaId,
      p_cash_session_id: input.cashSessionId,
      p_sale_number: createSaleNumber(),
      p_cashier_id: auth.userId,
      p_cliente_id: null,
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
    })

    if (error) return err({ kind: 'remote', message: getErrorMessage(error, 'Error al crear venta') })
    if (!data) return err({ kind: 'remote', message: 'Venta creada sin id de respuesta' })

    return ok({ saleId: data })
  }
}
