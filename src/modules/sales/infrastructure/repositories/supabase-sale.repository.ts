import { createClient } from '@/infrastructure/supabase/server'
import { ok, err } from '@/shared/result'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'
import type { Sale } from '../../domain/entities/sale.entity'
import type {
  SaleRepository,
  CreateSaleInput,
  VoidSaleInput,
} from '../../domain/repositories/sale.repository'
import { rowToSale, type SaleRow } from '../mappers/sale.mapper'

// @supabase/ssr v0.5 no resuelve los tipos Insert/Update.
/* eslint-disable @typescript-eslint/no-explicit-any */

const SALE_COLS = 'id, tienda_id, cash_session_id, sale_number, cliente_id, cashier_id, subtotal, discount_total, tax_total, total, status, billing_status, billing_document_id, voided_by, voided_at, voided_reason, idempotency_key, created_at, updated_at'
const ITEM_COLS = 'id, sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price, discount_amount, tax_rate, tax_amount, total'
const PAY_COLS  = 'id, sale_id, metodo, amount, referencia, created_at'

export class SupabaseSaleRepository implements SaleRepository {
  async create(input: CreateSaleInput): Promise<Result<Sale>> {
    const supabase = await createClient()

    const { data: saleId, error } = await (supabase as any).rpc('create_sale_atomic', {
      p_tienda_id:       input.tiendaId,
      p_cash_session_id: input.cashSessionId,
      p_sale_number:     input.saleNumber,
      p_cashier_id:      input.cashierId,
      p_cliente_id:      input.clienteId ?? null,
      p_subtotal:        input.subtotal,
      p_discount_total:  input.discountTotal,
      p_tax_total:       input.taxTotal,
      p_total:           input.total,
      p_idempotency_key: input.idempotencyKey,
      p_items: input.items.map((item) => ({
        producto_id:     item.productId,
        producto_nombre: item.productoNombre,
        producto_sku:    item.productoSku ?? null,
        quantity:        item.quantity,
        unit_price:      item.unitPrice,
        discount_amount: item.discountAmount,
        tax_rate:        item.taxRate,
        tax_amount:      item.taxAmount,
        total:           item.total,
      })),
      p_payments: input.payments.map((p) => ({
        metodo:     p.metodo,
        amount:     p.amount,
        referencia: p.referencia ?? null,
      })),
    })

    if (error) return err(new Error(error.message))

    const full = await this.findById(saleId as string, input.tiendaId)
    if (!full.ok) return err(full.error)
    if (!full.value) return err(new Error('Venta creada pero no encontrada'))
    return ok(full.value)
  }

  async findById(id: string, tiendaId: TiendaId): Promise<Result<Sale | null>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sales')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .maybeSingle()
      .returns<SaleRow>()

    if (error) return err(new Error(error.message))
    return ok(data ? rowToSale(data) : null)
  }

  async listBySession(cashSessionId: string, tiendaId: TiendaId): Promise<Result<Sale[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sales')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('cash_session_id', cashSessionId)
      .eq('tienda_id', tiendaId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .returns<SaleRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToSale))
  }

  async listByDate(tiendaId: TiendaId, date: Date): Promise<Result<Sale[]>> {
    const start = new Date(date); start.setHours(0, 0, 0, 0)
    const end   = new Date(date); end.setHours(23, 59, 59, 999)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sales')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('tienda_id', tiendaId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .returns<SaleRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToSale))
  }

  async void(input: VoidSaleInput): Promise<Result<Sale>> {
    const supabase = await createClient()
    const { data: saleId, error } = await (supabase as any).rpc('void_sale_atomic', {
      p_sale_id:       input.saleId,
      p_tienda_id:     input.tiendaId,
      p_voided_by:     input.voidedBy,
      p_voided_reason: input.voidedReason,
    })
    if (error) return err(new Error(error.message))

    const full = await this.findById(saleId as string, input.tiendaId)
    if (!full.ok) return err(full.error)
    if (!full.value) return err(new Error('Venta anulada pero no encontrada'))
    return ok(full.value)
  }

  private async findByIdempotencyKey(key: string, tiendaId: TiendaId): Promise<Result<Sale>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sales')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('idempotency_key', key)
      .eq('tienda_id', tiendaId)
      .single()
      .returns<SaleRow>()  // single() devuelve tipado correcto

    if (error) return err(new Error(error.message))
    return ok(rowToSale(data))
  }
}
