import type { BillingStatus, PaymentMethod, SaleStatus, TiendaId, UserId } from '@/shared/types'

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  productoNombre: string
  productoSku: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  /** Parte del descuento global asignada a esta línea. */
  globalDiscountAmount: number
  taxRate: number
  taxAmount: number
  total: number
}

export interface Payment {
  id: string
  saleId: string
  metodo: PaymentMethod
  amount: number
  referencia: string | null
  createdAt: Date
}

export interface Sale {
  id: string
  tiendaId: TiendaId
  cashSessionId: string
  saleNumber: string
  clienteId: string | null
  clienteNombre: string | null
  cashierId: UserId
  cashierEmail: string | null
  status: SaleStatus
  billingStatus: BillingStatus
  billingDocumentId: string | null
  items: SaleItem[]
  payments: Payment[]
  subtotal: number
  itemDiscountTotal: number
  globalDiscountTotal: number
  discountTotal: number
  discountReason: string | null
  discountApprovedBy: string | null
  taxTotal: number
  total: number
  change: number
  idempotencyKey: string
  voidedBy: UserId | null
  voidedAt: Date | null
  voidedReason: string | null
  createdAt: Date
  updatedAt: Date
}
