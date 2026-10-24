import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { rpcArgs } from '@angular-app/core/supabase/rpc-args'
import { fetchAllPages } from '@angular-app/core/supabase/fetch-all-pages'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { rowToSale, type SaleRow } from '@angular-app/features/sales/data/models/sale.mapper'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import {
  SaleRepository as SaleRepositoryContract,
  type CreateSaleRequest,
} from '@angular-app/features/sales/domain/repositories/sale.repository'
import type { PaymentMethod } from '@/shared/types'

const SALE_COLS =
  'id, tienda_id, cash_session_id, sale_number, cliente_id, cashier_id, cashier_email, subtotal, item_discount_total, global_discount_total, discount_total, discount_reason, discount_approved_by, tax_total, total, status, billing_status, billing_document_id, voided_by, voided_at, voided_reason, idempotency_key, created_at, updated_at'
const ITEM_COLS =
  'id, sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price, unit_cost, discount_amount, global_discount_amount, option_nombre, option_extra, tax_rate, tax_amount, total'
const PAY_COLS = 'id, sale_id, metodo, amount, referencia, created_at'

@Injectable({ providedIn: 'root' })
export class SalesRepository extends SaleRepositoryContract {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly audit = inject(AuditLogRepository)

  async create(request: CreateSaleRequest): Promise<string> {
    const { data, error } = await this.supabaseClient.supabase.rpc('create_sale_atomic', rpcArgs('create_sale_atomic', {
      p_tienda_id: request.tiendaId,
      p_cash_session_id: request.cashSessionId,
      // El sale_number lo genera create_sale_atomic (correlativo por tienda).
      // Se envía un placeholder porque la firma del RPC lo exige, pero el RPC lo ignora.
      p_sale_number: '',
      p_cashier_id: request.cashierId,
      p_cliente_id: request.clienteId,
      p_subtotal: request.totals.subtotal,
      p_discount_total: request.totals.discountTotal,
      p_tax_total: request.totals.taxTotal,
      p_total: request.totals.total,
      p_idempotency_key: request.idempotencyKey,
      p_items: request.items.map((item) => ({
        producto_id: item.productId,
        producto_nombre: item.nombre,
        producto_sku: item.sku ?? null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        option_id: item.optionId ?? null,
        discount_amount: item.discountAmount,
        tax_rate: item.taxRate,
        tax_amount: item.taxAmount,
        total: item.total,
      })),
      p_payments: request.payments.map((payment) => ({
        metodo: payment.metodo,
        amount: payment.amount,
        referencia: payment.referencia ?? null,
      })),
      p_global_discount_total: request.globalDiscountTotal,
      p_discount_reason: request.discountReason,
      p_loyalty_redemptions:
        request.loyaltyRedemptions.length > 0
          ? request.loyaltyRedemptions.map((r) => ({ reward_id: r.rewardId, item_index: r.itemIndex }))
          : null,
    }))

    // postgrest-js (sin `.throwOnError()`) devuelve `error` como objeto plano
    // `{ message, ... }`, NO una instancia de Error: se relanza con el texto
    // crudo de la RPC (ej. 'Stock insuficiente') para que presentation lo traduzca.
    if (error) throw new Error(error.message?.trim() ? error.message : 'Error al crear venta')
    if (!data) throw new Error('Venta creada sin id de respuesta')

    void this.audit.log({
      tiendaId: request.tiendaId,
      entityType: 'venta',
      entityId: data,
      action: 'create',
      changes: {
        total: request.totals.total,
        items: request.items.length,
        payments: request.payments.map((p) => p.metodo),
      },
    })
    return data
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
    tiendaId: string,
  ): Promise<{ id: string; saleNumber: string; total: number } | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('sales')
      .select('id, sale_number, total')
      .eq('tienda_id', tiendaId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? { id: data.id, saleNumber: data.sale_number, total: Number(data.total) } : null
  }

  async findById(saleId: string, tiendaId: string): Promise<Sale | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('sales')
      .select(`${SALE_COLS}, clientes(nombre), sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
      .eq('id', saleId)
      .eq('tienda_id', tiendaId)
      .maybeSingle<SaleRow>()

    if (error) throw new Error(error.message)
    return data ? rowToSale(data) : null
  }

  async listBySession(cashSessionId: string, tiendaId: string): Promise<Sale[]> {
    const rows = await fetchAllPages<SaleRow>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('sales')
        .select(`${SALE_COLS}, clientes(nombre), sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
        .eq('cash_session_id', cashSessionId)
        .eq('tienda_id', tiendaId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
        .returns<SaleRow[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map(rowToSale)
  }

  /**
   * Lista las ventas de la tienda en el rango UTC semiabierto `[start, end)`.
   * El llamador calcula el rango (p. ej. el día calendario local de la tienda).
   * No recalcula límites: `created_at` es timestamptz (UTC).
   */
  async listByDate(tiendaId: string, start: Date, end: Date): Promise<Sale[]> {
    const rows = await fetchAllPages<SaleRow>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('sales')
        .select(`${SALE_COLS}, clientes(nombre), sale_items(${ITEM_COLS}), payments(${PAY_COLS})`)
        .eq('tienda_id', tiendaId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
        .returns<SaleRow[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map(rowToSale)
  }

  async voidSale(saleId: string, tiendaId: string, reason: string): Promise<void> {
    const auth = this.supabaseClient.supabase
    const { data: userData } = await auth.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('No autenticado')

    const { error } = await this.supabaseClient.supabase.rpc('void_sale_atomic', {
      p_sale_id: saleId,
      p_tienda_id: tiendaId,
      p_voided_by: userId,
      p_voided_reason: reason,
    })
    if (error) throw new Error(error.message)
    // void_sale_atomic ya audita (sale.voided) con usuario y venta.
  }

  async correctPayment(
    paymentId: string,
    tiendaId: string,
    newMetodo: string,
    reason: string,
  ): Promise<void> {
    const { data: userData } = await this.supabaseClient.supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('No autenticado')

    const { error } = await this.supabaseClient.supabase.rpc('correct_payment_atomic', {
      p_payment_id:   paymentId,
      p_tienda_id:    tiendaId,
      // El contrato del dominio recibe string; PostgreSQL rechaza valores fuera del enum.
      p_new_metodo:   newMetodo as PaymentMethod,
      p_corrected_by: userId,
      p_reason:       reason,
    })
    if (error) throw new Error(error.message)
  }

  async correctSaleCustomer(
    saleId: string,
    tiendaId: string,
    clienteId: string,
    reason: string,
  ): Promise<void> {
    const { data: userData } = await this.supabaseClient.supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('No autenticado')

    const { error } = await this.supabaseClient.supabase.rpc('correct_sale_customer_atomic', {
      p_sale_id:      saleId,
      p_tienda_id:    tiendaId,
      p_cliente_id:   clienteId,
      p_corrected_by: userId,
      p_reason:       reason,
    })
    if (error) throw new Error(error.message)
  }
}
