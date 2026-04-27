import type { Sale, SaleItem, Payment } from '../../domain/entities/sale.entity'
import type { SaleStatus, BillingStatus, PaymentMethod } from '@/shared/types'

export type SaleRow = {
  id: string; tienda_id: string; cash_session_id: string; sale_number: string
  cliente_id: string | null; cashier_id: string; subtotal: number
  discount_total: number; tax_total: number; total: number; status: string
  billing_status: string; billing_document_id: string | null
  voided_by: string | null; voided_at: string | null; voided_reason: string | null
  idempotency_key: string; created_at: string; updated_at: string
  sale_items?: SaleItemRow[]
  payments?: PaymentRow[]
}

export type SaleItemRow = {
  id: string; sale_id: string; producto_id: string; producto_nombre: string
  producto_sku: string | null; quantity: number; unit_price: number
  discount_amount: number; tax_rate: number; tax_amount: number; total: number
}

export type PaymentRow = {
  id: string; sale_id: string; metodo: string; amount: number
  referencia: string | null; created_at: string
}

export function rowToSaleItem(row: SaleItemRow): SaleItem {
  return {
    id:             row.id,
    saleId:         row.sale_id,
    productId:      row.producto_id,
    productoNombre: row.producto_nombre,
    productoSku:    row.producto_sku,
    quantity:       Number(row.quantity),
    unitPrice:      Number(row.unit_price),
    discountAmount: Number(row.discount_amount),
    taxRate:        Number(row.tax_rate),
    taxAmount:      Number(row.tax_amount),
    total:          Number(row.total),
  }
}

export function rowToPayment(row: PaymentRow): Payment {
  return {
    id:         row.id,
    saleId:     row.sale_id,
    metodo:     row.metodo as PaymentMethod,
    amount:     Number(row.amount),
    referencia: row.referencia,
    createdAt:  new Date(row.created_at),
  }
}

export function rowToSale(row: SaleRow): Sale {
  return {
    id:                 row.id,
    tiendaId:           row.tienda_id,
    cashSessionId:      row.cash_session_id,
    saleNumber:         row.sale_number,
    clienteId:          row.cliente_id,
    cashierId:          row.cashier_id,
    status:             row.status as SaleStatus,
    billingStatus:      row.billing_status as BillingStatus,
    billingDocumentId:  row.billing_document_id,
    items:              (row.sale_items ?? []).map(rowToSaleItem),
    payments:           (row.payments   ?? []).map(rowToPayment),
    subtotal:           Number(row.subtotal),
    discountTotal:      Number(row.discount_total),
    taxTotal:           Number(row.tax_total),
    total:              Number(row.total),
    change:             0,
    idempotencyKey:     row.idempotency_key,
    voidedBy:           row.voided_by,
    voidedAt:           row.voided_at ? new Date(row.voided_at) : null,
    voidedReason:       row.voided_reason,
    createdAt:          new Date(row.created_at),
    updatedAt:          new Date(row.updated_at),
  }
}
