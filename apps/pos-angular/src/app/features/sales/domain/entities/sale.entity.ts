import type { BillingStatus, PaymentMethod, SaleStatus, TiendaId, UserId } from '@/shared/types'

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  productoNombre: string
  productoSku: string | null
  quantity: number
  /** Precio efectivo por unidad: precio base + recargo de la opción (ADR 0017). */
  unitPrice: number
  /**
   * Costo unitario congelado en el momento de la venta (ADR 0019). `null` =
   * costo desconocido: la línea se excluye de la utilidad, nunca se asume 0.
   * En un combo es la suma del costo de los productos incluidos.
   */
  unitCost: number | null
  /** Opción con la que se preparó (ej. proteína del batido). `null` = sin opción. */
  optionNombre: string | null
  /** Recargo unitario de la opción, ya incluido en `unitPrice`. Solo desglose. */
  optionExtra: number
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
  /** Recargo cobrado aparte por pagar con tarjeta (ADR 0024). 0 en otros métodos. */
  cardSurcharge: number
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
  /** Suma del recargo por tarjeta; no hace parte de `total` (ADR 0024). */
  cardSurcharge: number
  /** Tarifa de la tarjeta usada en la venta (snapshot); null si no hubo tarjeta. */
  cardFeeRateBps: number | null
  cardFeeIvaPct: number | null
  change: number
  idempotencyKey: string
  voidedBy: UserId | null
  voidedAt: Date | null
  voidedReason: string | null
  createdAt: Date
  updatedAt: Date
}
