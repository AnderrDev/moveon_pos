import type { IvaRate } from '@/shared/types'

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

export function calculateCartTotals(items: CartItemCalculated[]): CartTotals {
  return items.reduce<CartTotals>(
    (acc, item) => ({
      subtotal:      acc.subtotal      + item.subtotalBruto,
      discountTotal: acc.discountTotal + item.descuentoTotal,
      taxTotal:      acc.taxTotal      + item.taxAmount,
      total:         acc.total         + item.total,
    }),
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 },
  )
}

export function calculateChange(totalPaid: number, saleTotal: number): number {
  return Math.max(0, totalPaid - saleTotal)
}
