import {
  discountPerUnit,
  type DiscountMode,
  type ItemDiscountFormValue,
} from './item-discount-form.factory'

export const itemDiscountFormMapper = {
  /** Siempre abre en pesos con el descuento que ya tiene la línea. */
  toFormValue(item: { discountAmount: number } | null): ItemDiscountFormValue {
    return { discountMode: 'amount', discountAmount: item?.discountAmount ?? 0, discountPercent: 0 }
  },

  /**
   * Cambia de modo reflejando el descuento actual en el campo que se va a
   * mostrar; la fuente de verdad sigue siendo el monto por unidad en pesos.
   */
  switchMode(value: ItemDiscountFormValue, mode: DiscountMode, unitPrice: number): ItemDiscountFormValue {
    if (value.discountMode === mode) return value
    if (mode === 'percent') {
      const percent = unitPrice > 0 ? Math.round((value.discountAmount / unitPrice) * 100) : 0
      return { ...value, discountMode: mode, discountPercent: percent }
    }
    return { ...value, discountMode: mode, discountAmount: discountPerUnit(value, unitPrice) }
  },

  toDiscountAmount(value: ItemDiscountFormValue, unitPrice: number): number {
    return discountPerUnit(value, unitPrice)
  },
}
