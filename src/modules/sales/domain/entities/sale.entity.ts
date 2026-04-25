import type { SaleStatus, PaymentMethod, TiendaId, UserId, IvaRate } from '@/shared/types'

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  ivaTasa: IvaRate
  subtotal: number
  ivaAmount: number
  total: number
}

export interface Payment {
  method: PaymentMethod
  amount: number
}

export interface Sale {
  id: string
  tiendaId: TiendaId
  cashSessionId: string
  customerId: string | null
  status: SaleStatus
  items: SaleItem[]
  payments: Payment[]
  subtotal: number
  totalDiscount: number
  totalIva: number
  total: number
  change: number
  idempotencyKey: string
  createdBy: UserId
  voidedBy: UserId | null
  voidedAt: Date | null
  voidedReason: string | null
  createdAt: Date
  updatedAt: Date
}
