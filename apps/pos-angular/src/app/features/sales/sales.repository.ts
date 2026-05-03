import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import { rowToSale, type SaleRow } from '@/modules/sales/infrastructure/mappers/sale.mapper'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

const SALE_COLS =
  'id, tienda_id, cash_session_id, sale_number, cliente_id, cashier_id, subtotal, discount_total, tax_total, total, status, billing_status, billing_document_id, voided_by, voided_at, voided_reason, idempotency_key, created_at, updated_at'
const ITEM_COLS =
  'id, sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price, discount_amount, tax_rate, tax_amount, total'
const PAY_COLS = 'id, sale_id, metodo, amount, referencia, created_at'

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

@Injectable({ providedIn: 'root' })
export class SalesRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  async listBySession(cashSessionId: string, tiendaId: string): Promise<Sale[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('sales')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('cash_session_id', cashSessionId)
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .returns<SaleRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToSale)
  }

  async listByDate(tiendaId: string, date: Date): Promise<Sale[]> {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await this.supabaseClient.supabase
      .from('sales')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('tienda_id', tiendaId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .returns<SaleRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToSale)
  }

  async voidSale(saleId: string, tiendaId: string, reason: string): Promise<void> {
    const auth = this.supabaseClient.supabase
    const { data: userData } = await auth.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('No autenticado')

    const client = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await client.rpc<void>('void_sale_atomic', {
      p_sale_id: saleId,
      p_tienda_id: tiendaId,
      p_voided_by: userId,
      p_voided_reason: reason,
    })
    if (error) throw new Error(error.message)
  }
}
