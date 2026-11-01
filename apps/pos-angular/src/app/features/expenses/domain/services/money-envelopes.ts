/**
 * Reparto del dinero en sobres (ADR 0025, simplificado el 2026-11-01 por el
 * dueño: "la idea es solo separar la plata de inventario de la utilidad").
 * Cada peso que entra por ventas desde la fecha de inicio se reparte así:
 *
 *   1. Mercancía — el costo exacto de lo vendido (es el fondo de reinversión).
 *   2. Gastos    — lo que de verdad se registró como gasto (arriendo, nómina,
 *                  caja, insumos…), sin apartar nada por adelantado.
 *   3. Utilidad  — lo que sobra; de ahí salen los retiros del dueño.
 *
 * Los sobres arrastran saldo desde la fecha de inicio. Función pura — la
 * página la alimenta con los totales de la RPC `get_money_envelope_totals`
 * y la configuración del fondo.
 */

export type EnvelopeKey = 'mercancia' | 'gastos' | 'utilidad'

export const ENVELOPE_KEYS: readonly EnvelopeKey[] = ['mercancia', 'gastos', 'utilidad']

/** Totales desde la fecha de inicio + desglose del mes visible (los devuelve la RPC). */
export interface MoneyEnvelopeTotals {
  /** Ventas completadas (sin recargo de tarjeta). */
  entradasAcumuladas: number
  entradasMes: number
  /** Σ costo de lo vendido (líneas con costo). */
  cogsAcumulado: number
  cogsMes: number
  /** Compras de mercancía: entradas de inventario con costo (incluye stock inicial). */
  comprasAcumuladas: number
  comprasMes: number
  /** Gastos activos de arriendo y nómina (ligados a empleado o a plantilla activa). */
  fijosPagadosAcumulados: number
  fijosPagadosMes: number
  /** Los demás gastos activos. */
  variablesAcumulados: number
  variablesMes: number
  /** Retiros activos del dueño. */
  retirosAcumulados: number
  retirosMes: number
  /** Costo de lo vendido en los últimos 28 días (para días de inventario). */
  cogsUltimos28Dias: number
  ventasSinCosto: number
  entradasSinCosto: number
}

export interface EnvelopeOpeningBalances {
  mercancia: number
  utilidad: number
}

export interface MoneyEnvelopesInput extends MoneyEnvelopeTotals {
  saldosIniciales: EnvelopeOpeningBalances
}

export interface Envelope {
  key: EnvelopeKey
  saldoInicial: number
  apartadoAcumulado: number
  usadoAcumulado: number
  /** saldo inicial + apartado − usado. Negativo = se usó plata de otro sobre. */
  disponible: number
  apartadoMes: number
  usadoMes: number
}

export interface MoneyEnvelopes {
  entradasAcumuladas: number
  entradasMes: number
  sobres: Record<EnvelopeKey, Envelope>
  ventasSinCosto: number
  entradasSinCosto: number
}

function envelope(
  key: EnvelopeKey,
  saldoInicial: number,
  apartadoAcumulado: number,
  usadoAcumulado: number,
  apartadoMes: number,
  usadoMes: number,
): Envelope {
  return {
    key,
    saldoInicial,
    apartadoAcumulado,
    usadoAcumulado,
    disponible: saldoInicial + apartadoAcumulado - usadoAcumulado,
    apartadoMes,
    usadoMes,
  }
}

export function buildMoneyEnvelopes(input: MoneyEnvelopesInput): MoneyEnvelopes {
  const { saldosIniciales: s } = input

  const mercancia = envelope(
    'mercancia',
    s.mercancia,
    input.cogsAcumulado,
    input.comprasAcumuladas,
    input.cogsMes,
    input.comprasMes,
  )
  // Gastos: se aparta exactamente lo gastado (fijos pagados + día a día); nunca acumula saldo.
  const gastosAcum = input.fijosPagadosAcumulados + input.variablesAcumulados
  const gastosMes = input.fijosPagadosMes + input.variablesMes
  const gastos = envelope('gastos', 0, gastosAcum, gastosAcum, gastosMes, gastosMes)

  const utilidad = envelope(
    'utilidad',
    s.utilidad,
    input.entradasAcumuladas - input.cogsAcumulado - gastosAcum,
    input.retirosAcumulados,
    input.entradasMes - input.cogsMes - gastosMes,
    input.retirosMes,
  )

  return {
    entradasAcumuladas: input.entradasAcumuladas,
    entradasMes: input.entradasMes,
    sobres: { mercancia, gastos, utilidad },
    ventasSinCosto: input.ventasSinCosto,
    entradasSinCosto: input.entradasSinCosto,
  }
}
