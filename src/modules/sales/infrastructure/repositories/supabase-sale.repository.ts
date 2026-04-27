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
    const db = supabase as any

    // 1. Insertar venta
    const { data: saleRow, error: saleErr } = await db
      .from('sales')
      .insert({
        tienda_id:       input.tiendaId,
        cash_session_id: input.cashSessionId,
        sale_number:     input.saleNumber,
        cashier_id:      input.cashierId,
        cliente_id:      input.clienteId ?? null,
        subtotal:        input.subtotal,
        discount_total:  input.discountTotal,
        tax_total:       input.taxTotal,
        total:           input.total,
        idempotency_key: input.idempotencyKey,
      })
      .select(SALE_COLS)
      .single()

    if (saleErr) {
      // Idempotencia: si ya existe con esa key, devolver la venta existente
      if (saleErr.code === '23505' && saleErr.message.includes('idempotency')) {
        return this.findByIdempotencyKey(input.idempotencyKey, input.tiendaId)
      }
      return err(new Error(saleErr.message))
    }

    const saleId = (saleRow as SaleRow).id

    // 2. Insertar ítems
    const itemsInsert = input.items.map((item) => ({
      sale_id:         saleId,
      producto_id:     item.productId,
      producto_nombre: item.productoNombre,
      producto_sku:    item.productoSku ?? null,
      quantity:        item.quantity,
      unit_price:      item.unitPrice,
      discount_amount: item.discountAmount,
      tax_rate:        item.taxRate,
      tax_amount:      item.taxAmount,
      total:           item.total,
    }))

    const { error: itemsErr } = await db
      .from('sale_items')
      .insert(itemsInsert)

    if (itemsErr) return err(new Error(itemsErr.message))

    // 3. Insertar pagos
    const paymentsInsert = input.payments.map((p) => ({
      sale_id:    saleId,
      metodo:     p.metodo,
      amount:     p.amount,
      referencia: p.referencia ?? null,
    }))

    const { error: payErr } = await db
      .from('payments')
      .insert(paymentsInsert)

    if (payErr) return err(new Error(payErr.message))

    // 4. Crear movimientos de inventario (sale_exit)
    const invInsert = input.items.map((item) => ({
      tienda_id:      input.tiendaId,
      producto_id:    item.productId,
      tipo:           'sale_exit',
      cantidad:       -item.quantity,
      referencia_tipo: 'sale',
      referencia_id:  saleId,
      created_by:     input.cashierId,
    }))

    const { error: invErr } = await db
      .from('inventory_movements')
      .insert(invInsert)

    if (invErr) return err(new Error(invErr.message))

    // 5. Leer venta completa con ítems y pagos
    const full = await this.findById(saleId, input.tiendaId)
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
    const { data, error } = await (supabase as any)
      .from('sales')
      .update({
        status:        'voided',
        voided_by:     input.voidedBy,
        voided_at:     new Date().toISOString(),
        voided_reason: input.voidedReason,
      })
      .eq('id', input.saleId)
      .eq('tienda_id', input.tiendaId)
      .eq('status', 'completed')
      .select(`${SALE_COLS}, sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .single()

    if (error) return err(new Error(error.message))

    // Revertir movimientos de inventario (void_return)
    const db = supabase as any
    const itemsResult = await this.findById(input.saleId, input.tiendaId)
    if (itemsResult.ok && itemsResult.value) {
      const returnInsert = itemsResult.value.items.map((item) => ({
        tienda_id:      input.tiendaId,
        producto_id:    item.productId,
        tipo:           'void_return',
        cantidad:       item.quantity,
        referencia_tipo: 'sale',
        referencia_id:  input.saleId,
        created_by:     input.voidedBy,
        motivo:         input.voidedReason,
      }))
      await db.from('inventory_movements').insert(returnInsert)
    }

    return ok(rowToSale(data as SaleRow))
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
