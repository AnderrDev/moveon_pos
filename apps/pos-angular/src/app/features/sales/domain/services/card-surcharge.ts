/**
 * Recargo por pago con tarjeta (ADR 0024). Replica la comisión de Nequi
 * Negocios: 1,99 % del monto + 19 % de IVA sobre esa comisión, redondeando al
 * peso. Todo en enteros (fracciones exactas) para no arrastrar errores de punto
 * flotante.
 *
 * La prueba real ($1.500 → costo $36) no basta para saber CÓMO redondea Nequi,
 * así que la regla es configurable (`rounding` + `ivaBase`). Los montos que
 * distinguen todas las reglas están en el test y en el ADR 0024 §1. La regla
 * por defecto la confirmó el dueño con la calculadora de Nequi (2026-10-26).
 */

export type CardFeeRounding = 'half-up' | 'half-even' | 'ceil'

/**
 * - `rounded-commission`: IVA sobre la comisión ya redondeada (como la
 *   calculadora de Nequi: 1,99 % → $30, IVA $6).
 * - `exact-commission`: comisión e IVA se redondean por separado, el IVA sobre
 *   la comisión sin redondear.
 * - `single-rounding`: el costo total (1,99 % × 1,19) se redondea una sola vez.
 */
export type CardFeeIvaBase = 'rounded-commission' | 'exact-commission' | 'single-rounding'

export interface CardFeeConfig {
  /** Comisión en puntos básicos (199 = 1,99 %). */
  rateBps: number
  /** IVA sobre la comisión, en porcentaje entero (19 = 19 %). */
  ivaPct: number
  rounding: CardFeeRounding
  ivaBase: CardFeeIvaBase
}

export const NEQUI_CARD_FEE: CardFeeConfig = {
  rateBps: 199,
  ivaPct: 19,
  rounding: 'half-up',
  ivaBase: 'rounded-commission',
}

/** Límites por transacción con tarjeta en Nequi Negocios. */
export const CARD_CHARGE_MIN = 1500
export const CARD_CHARGE_MAX = 250000

export interface CardFeeBreakdown {
  commission: number
  iva: number
  /** commission + iva: lo que Nequi descuenta. */
  fee: number
  /** Lo que llega a la cuenta. */
  net: number
}

/** `numerator / denominator` redondeado al entero (ambos no negativos). */
function roundFraction(numerator: number, denominator: number, rounding: CardFeeRounding): number {
  const quotient = Math.floor(numerator / denominator)
  const remainder = numerator - quotient * denominator
  if (remainder === 0) return quotient
  if (rounding === 'ceil') return quotient + 1
  const twice = remainder * 2
  if (twice > denominator) return quotient + 1
  if (twice < denominator) return quotient
  // Exactamente la mitad.
  return rounding === 'half-up' || quotient % 2 === 1 ? quotient + 1 : quotient
}

/** Lo que Nequi descuenta de un cobro con tarjeta por `amount`. */
export function calculateCardFee(amount: number, config: CardFeeConfig = NEQUI_CARD_FEE): CardFeeBreakdown {
  const { rateBps, ivaPct, rounding, ivaBase } = config
  const commission = roundFraction(amount * rateBps, 10000, rounding)

  let iva: number
  if (ivaBase === 'rounded-commission') {
    iva = roundFraction(commission * ivaPct, 100, rounding)
  } else if (ivaBase === 'exact-commission') {
    iva = roundFraction(amount * rateBps * ivaPct, 1000000, rounding)
  } else {
    iva = roundFraction(amount * rateBps * (100 + ivaPct), 1000000, rounding) - commission
  }

  const fee = commission + iva
  return { commission, iva, fee, net: amount - fee }
}

export interface CardCharge {
  /** Parte de la venta que cubre la tarjeta (lo que debe llegar neto). */
  baseAmount: number
  /** Monto a pasar por el datáfono. */
  chargeAmount: number
  /** chargeAmount − baseAmount: lo que paga el cliente por usar tarjeta. */
  surcharge: number
}

/**
 * Menor monto a cobrar con tarjeta para que, después de la comisión, llegue
 * `baseAmount`. El neto sube a lo sumo $1 por cada peso cobrado (el costo nunca
 * baja), así que el primer monto que cubre la base la cubre exacta.
 */
export function calculateCardCharge(baseAmount: number, config: CardFeeConfig = NEQUI_CARD_FEE): CardCharge {
  const base = Math.max(0, Math.round(baseAmount))
  if (base === 0) return { baseAmount: 0, chargeAmount: 0, surcharge: 0 }

  // Cota inferior segura: los redondeos bajan el costo menos de $1,10 en total,
  // así que ningún monto por debajo de (base − 2) / (1 − tasa) cubre la base.
  const effectiveRate = (config.rateBps / 10000) * (1 + config.ivaPct / 100)
  let charge = Math.max(base, Math.floor((base - 2) / (1 - effectiveRate)) - 1)
  while (calculateCardFee(charge, config).net < base) charge += 1

  return { baseAmount: base, chargeAmount: charge, surcharge: charge - base }
}

/** Valida el monto a pasar por el datáfono contra los límites de Nequi. */
export function validateCardChargeAmount(chargeAmount: number): string | null {
  if (chargeAmount < CARD_CHARGE_MIN) return 'El cobro con tarjeta debe ser de al menos $1.500'
  if (chargeAmount > CARD_CHARGE_MAX) return 'El cobro con tarjeta no puede superar $250.000'
  return null
}
