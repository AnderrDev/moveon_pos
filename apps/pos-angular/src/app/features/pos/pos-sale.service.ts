import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import { SessionService } from '../../core/auth/session.service'
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

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

function createSaleNumber(now = new Date()): string {
  const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `${prefix}-${String(now.getTime())}`
}

@Injectable({ providedIn: 'root' })
export class PosSaleService {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly sessionService = inject(SessionService)

  async createSale(input: CreatePosSaleInput): Promise<CreatePosSaleResult> {
    const auth = await this.sessionService.getAuthContext()
    if (!auth) throw new Error('No autenticado')

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

    if (error) throw new Error(error.message)

    if (!data) throw new Error('Venta creada sin id de respuesta')

    return { saleId: data }
  }
}
