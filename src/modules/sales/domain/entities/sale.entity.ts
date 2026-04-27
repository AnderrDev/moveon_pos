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
  cashierId: UserId
  status: SaleStatus
  billingStatus: BillingStatus
  billingDocumentId: string | null
  items: SaleItem[]
  payments: Payment[]
  subtotal: number
  discountTotal: number
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
