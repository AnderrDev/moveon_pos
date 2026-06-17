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
  subtotalBruto: number // Precio final (IVA incluido) * quantity
  descuentoTotal: number // discountAmount * quantity
  baseImponible: number // Total sin el IVA incluido
  taxAmount: number // IVA contenido en el total
  total: number // subtotalBruto - descuentoTotal
}

export interface CartTotals {
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
}

export function calculateCartItem(item: CartItemInput): CartItemCalculated {
  const subtotalBruto = Math.round(item.unitPrice * item.quantity)
  const descuentoTotal = Math.round(item.discountAmount * item.quantity)
  const total = Math.max(0, subtotalBruto - descuentoTotal)
  const baseImponible = item.ivaTasa === 0 ? total : Math.round(total / (1 + item.ivaTasa / 100))
  const taxAmount = total - baseImponible

  return { ...item, subtotalBruto, descuentoTotal, baseImponible, taxAmount, total }
}

export function calculateCartTotals(items: CartItemCalculated[], globalDiscount = 0): CartTotals {
  const itemTotals = items.reduce<CartTotals>(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotalBruto,
      discountTotal: acc.discountTotal + item.descuentoTotal,
      taxTotal: acc.taxTotal + item.taxAmount,
      total: acc.total + item.total,
    }),
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }
  )

  const effectiveDiscount = Math.max(0, Math.min(Math.round(globalDiscount), itemTotals.total))
  if (effectiveDiscount === 0 || items.length === 0) return itemTotals

  let allocated = 0
  let taxTotal = 0
  for (const [index, item] of items.entries()) {
    const allocation =
      index === items.length - 1
        ? effectiveDiscount - allocated
        : Math.round((effectiveDiscount * item.total) / itemTotals.total)
    allocated += allocation
    const discountedTotal = Math.max(0, item.total - allocation)
    const base =
      item.ivaTasa === 0 ? discountedTotal : Math.round(discountedTotal / (1 + item.ivaTasa / 100))
    taxTotal += discountedTotal - base
  }

  return {
    subtotal: itemTotals.subtotal,
    discountTotal: itemTotals.discountTotal + effectiveDiscount,
    taxTotal,
    total: itemTotals.total - effectiveDiscount,
  }
}

/**
 * Helper para totales ya agregados. El flujo principal usa `calculateCartTotals`
 * porque necesita las tasas de cada línea para recalcular correctamente el IVA.
 */
export function applyGlobalDiscount(totals: CartTotals, globalDiscount: number): CartTotals {
  const effectiveDiscount = Math.max(0, Math.min(Math.round(globalDiscount), totals.total))
  if (effectiveDiscount === 0) return totals

  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal + effectiveDiscount,
    taxTotal: totals.taxTotal,
    total: totals.total - effectiveDiscount,
  }
}

export function calculateChange(totalPaid: number, saleTotal: number): number {
  return Math.max(0, totalPaid - saleTotal)
}

export interface PaymentValidationInput {
  metodo: PaymentMethod
  amount: number
}

/**
 * Recorta el vuelto (cambio) de los pagos en efectivo antes de persistirlos.
 * Si el cajero recibe más efectivo del que cubre el total (ej. paga $50.000
 * por una venta de $26.000), el monto que se guarda como pago no debe
 * incluir el vuelto entregado — de lo contrario cualquier suma de pagos
 * (cierre de caja, reportes) queda inflada por el vuelto.
 *
 * Requiere que `payments` ya haya pasado `validatePaymentsForSale` (el
 * cambio siempre sale de efectivo), por eso nunca deja un pago en negativo.
 */
export function normalizePaymentsForPersistence<T extends PaymentValidationInput>(
  payments: T[],
  saleTotal: number
): T[] {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  let changeRemaining = calculateChange(totalPaid, saleTotal)
  if (changeRemaining <= 0) return payments

  return payments.map((payment) => {
    if (payment.metodo !== 'cash' || changeRemaining <= 0) return payment
    const reduction = Math.min(payment.amount, changeRemaining)
    changeRemaining -= reduction
    return { ...payment, amount: payment.amount - reduction }
  })
}

export function validatePaymentsForSale(
  payments: PaymentValidationInput[],
  saleTotal: number
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
  threshold = 0.1
): string | null {
  if (role === 'admin') return null
  if (discountTotal > Math.round(subtotal * threshold)) {
    return 'Descuentos mayores al 10% requieren aprobación de admin'
  }

  return null
}
