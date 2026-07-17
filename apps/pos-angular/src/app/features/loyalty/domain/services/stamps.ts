/**
 * Reglas puras de sellos y recompensas MOVE ON Club (RN-LF01..LF14).
 *
 * El RPC `create_sale_atomic` es la autoridad: estas funciones replican la
 * misma lógica para previsualizar en la UI (progreso, sellos que otorgará el
 * carrito, descuento del canje) sin esperar al servidor.
 */

export interface StampEligibleLine {
  participaFidelizacion: boolean
  quantity: number
  /** Descuento manual por unidad de la línea. */
  discountAmount: number
  /** `true` si la línea tiene una recompensa canjeada (esa unidad no genera sello). */
  hasRedemption?: boolean
}

/**
 * Sellos que otorgaría una venta (RN-LF01/02/05). Nota: el descuento global
 * prorrateado también anula sellos por línea; eso solo lo resuelve el RPC con
 * el prorrateo exacto — aquí se asume la venta sin descuento global.
 */
export function countEligibleStampUnits(lines: StampEligibleLine[]): number {
  return lines.reduce((sum, line) => {
    if (!line.participaFidelizacion || line.discountAmount > 0) return sum
    const units = Math.floor(line.quantity) - (line.hasRedemption ? 1 : 0)
    return sum + Math.max(0, units)
  }, 0)
}

export interface StampCycleResult {
  rewardsGenerated: number
  balanceAfter: number
}

/**
 * Ciclos de recompensa al acumular sellos (RN-LF07): cada vez que el saldo
 * alcanza el umbral se consumen los sellos y se genera una recompensa.
 * Ejemplo del negocio: saldo 7 + 3 sellos = 1 recompensa, quedan 2.
 */
export function applyStampCycles(
  balanceBefore: number,
  earned: number,
  stampsPerReward: number,
): StampCycleResult {
  if (stampsPerReward <= 0) return { rewardsGenerated: 0, balanceAfter: balanceBefore + earned }
  const total = balanceBefore + earned
  return {
    rewardsGenerated: Math.floor(total / stampsPerReward),
    balanceAfter: total % stampsPerReward,
  }
}

/** RN-LF09: una recompensa vencida no puede redimirse. */
export function isRewardExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

/**
 * RN-LF08: el canje cubre hasta el valor de la recompensa; si el batido cuesta
 * más, el cliente paga la diferencia. Nunca cubre más que el precio.
 */
export function rewardDiscountForPrice(unitPrice: number, rewardValueCop: number): number {
  return Math.max(0, Math.min(unitPrice, rewardValueCop))
}

interface LoyaltyAdjustableItem {
  ivaTasa: number
  descuentoTotal: number
  baseImponible: number
  taxAmount: number
  total: number
}

/**
 * Aplica el descuento del canje UNA vez a la línea (no por unidad) y recalcula
 * base e IVA incluido, espejo del cálculo del RPC. Estructural a propósito:
 * el dominio de loyalty no importa entidades del módulo sales.
 */
export function applyLoyaltyDiscountToItem<T extends LoyaltyAdjustableItem>(
  item: T,
  loyaltyDiscount: number,
): T {
  const discount = Math.max(0, Math.min(Math.round(loyaltyDiscount), item.total))
  if (discount === 0) return item

  const total = item.total - discount
  const baseImponible = item.ivaTasa === 0 ? total : Math.round(total / (1 + item.ivaTasa / 100))

  return {
    ...item,
    descuentoTotal: item.descuentoTotal + discount,
    total,
    baseImponible,
    taxAmount: total - baseImponible,
  }
}
