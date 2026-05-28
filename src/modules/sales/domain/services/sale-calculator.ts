import type { IvaRate } from '@/shared/types'
import type { PaymentMethod, Role } from '@/shared/types'

export interface CartItemInput {
  productId: string
  nombre: string
  sku: string | null
  unitPrice: number
  ivaTasa: IvaRate
  quantity: number
  discountAmount: number
}

export interface CartItemCalculated extends CartItemInput {
  subtotalBruto: number   // unitPrice * quantity
  descuentoTotal: number  // discountAmount * quantity
  baseImponible: number   // subtotalBruto - descuentoTotal
  taxAmount: number       // baseImponible * ivaTasa / 100
  total: number           // baseImponible + taxAmount
}

export interface CartTotals {
  subtotal:      number
  discountTotal: number
  taxTotal:      number
  total:         number
}

export function calculateCartItem(item: CartItemInput): CartItemCalculated {
  const subtotalBruto   = Math.round(item.unitPrice * item.quantity)
  const descuentoTotal  = Math.round(item.discountAmount * item.quantity)
  const baseImponible   = subtotalBruto - descuentoTotal
  const taxAmount       = Math.round(baseImponible * item.ivaTasa / 100)
  const total           = baseImponible + taxAmount

  return { ...item, subtotalBruto, descuentoTotal, baseImponible, taxAmount, total }
}

export function calculateCartTotals(
  items: CartItemCalculated[],
  globalDiscount = 0,
): CartTotals {
  const itemTotals = items.reduce<CartTotals>(
    (acc, item) => ({
      subtotal:      acc.subtotal      + item.subtotalBruto,
      discountTotal: acc.discountTotal + item.descuentoTotal,
      taxTotal:      acc.taxTotal      + item.taxAmount,
      total:         acc.total         + item.total,
    }),
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 },
  )

  return applyGlobalDiscount(itemTotals, globalDiscount)
}

/**
 * Aplica un descuento global (en monto COP) como descuento comercial sobre el
 * TOTAL post-IVA. NO se prorratea entre ítems para no alterar el IVA por ítem
 * (`taxTotal` queda intacto). El monto efectivo se acota al total disponible,
 * de modo que `total` nunca sea negativo, y se suma a `discountTotal` para que
 * el ticket y los reportes reflejen el descuento completo (ítems + global).
 */
export function applyGlobalDiscount(totals: CartTotals, globalDiscount: number): CartTotals {
  const effectiveDiscount = Math.max(0, Math.min(Math.round(globalDiscount), totals.total))
  if (effectiveDiscount === 0) return totals

  return {
    subtotal:      totals.subtotal,
    discountTotal: totals.discountTotal + effectiveDiscount,
    taxTotal:      totals.taxTotal,
    total:         totals.total - effectiveDiscount,
  }
}

export function calculateChange(totalPaid: number, saleTotal: number): number {
  return Math.max(0, totalPaid - saleTotal)
}

export interface PaymentValidationInput {
  metodo: PaymentMethod
  amount: number
}

export function validatePaymentsForSale(
  payments: PaymentValidationInput[],
  saleTotal: number,
): string | null {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const cashPaid = payments.reduce((sum, p) => {
    return p.metodo === 'cash' ? sum + p.amount : sum
  }, 0)
  const nonCashPaid = totalPaid - cashPaid
  const change = calculateChange(totalPaid, saleTotal)

  if (totalPaid < saleTotal) return 'La suma de pagos no cubre el total de la venta'
  if (nonCashPaid > saleTotal || change > cashPaid) {
    return 'El cambio solo puede generarse desde pagos en efectivo'
  }

  return null
}

export function validateDiscountAuthorization(
  role: Role,
  subtotal: number,
  discountTotal: number,
  threshold = 0.1,
): string | null {
  if (role === 'admin') return null
  if (discountTotal > Math.round(subtotal * threshold)) {
    return 'Descuentos mayores al 10% requieren aprobación de admin'
  }

  return null
}
