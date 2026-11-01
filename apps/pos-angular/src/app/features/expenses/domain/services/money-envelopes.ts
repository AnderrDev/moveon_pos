/**
 * Reparto del dinero en sobres (ADR 0025). Cada peso que entra por ventas
 * desde la fecha de inicio se reparte en cuatro sobres, en este orden:
 *
 *   1. Mercancía   — el costo exacto de lo vendido (es el fondo de reinversión).
 *   2. Fijos       — arriendo + nómina del mes, apartados día a día.
 *   3. Día a día   — los gastos variables que de verdad se hicieron.
 *   4. Utilidad    — lo que sobra; de ahí salen los retiros del dueño.
 *
 * Los sobres arrastran saldo desde la fecha de inicio. Función pura — la
 * página la alimenta con los totales de la RPC `get_money_envelope_totals`,
 * la configuración del fondo y los fijos configurados.
 */

export type EnvelopeKey = 'mercancia' | 'fijos' | 'diaADia' | 'utilidad'

export const ENVELOPE_KEYS: readonly EnvelopeKey[] = ['mercancia', 'fijos', 'diaADia', 'utilidad']

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
  fijos: number
  utilidad: number
}

export interface MoneyEnvelopesInput extends MoneyEnvelopeTotals {
  saldosIniciales: EnvelopeOpeningBalances
  /**
   * Fijos apartados desde la fecha de inicio: meses completos enteros y el
   * mes en curso en proporción a los días transcurridos (`accrueFixedSince`).
   */
  fijosApartadosAcumulados: number
  fijosApartadosMes: number
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
  const fijos = envelope(
    'fijos',
    s.fijos,
    input.fijosApartadosAcumulados,
    input.fijosPagadosAcumulados,
    input.fijosApartadosMes,
    input.fijosPagadosMes,
  )
  // El día a día se aparta exactamente lo que se gastó: nunca acumula saldo.
  const diaADia = envelope(
    'diaADia',
    0,
    input.variablesAcumulados,
    input.variablesAcumulados,
    input.variablesMes,
    input.variablesMes,
  )
  const utilidadApartadaAcum =
    input.entradasAcumuladas - input.cogsAcumulado - input.fijosApartadosAcumulados - input.variablesAcumulados
  const utilidadApartadaMes =
    input.entradasMes - input.cogsMes - input.fijosApartadosMes - input.variablesMes
  const utilidad = envelope(
    'utilidad',
    s.utilidad,
    utilidadApartadaAcum,
    input.retirosAcumulados,
    utilidadApartadaMes,
    input.retirosMes,
  )

  return {
    entradasAcumuladas: input.entradasAcumuladas,
    entradasMes: input.entradasMes,
    sobres: { mercancia, fijos, diaADia, utilidad },
    ventasSinCosto: input.ventasSinCosto,
    entradasSinCosto: input.entradasSinCosto,
  }
}

/** Días del mes de una fecha `YYYY-MM-DD`. */
function daysInMonth(date: string): number {
  const [y, m] = date.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

function monthOf(date: string): string {
  return date.slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Fijos apartados entre `desde` y `hasta` (ambas `YYYY-MM-DD`, inclusive):
 * cada día aparta `fijosMensual ÷ días de su mes`. Así el arriendo del mes
 * está completo el último día y, en meses cerrados, se apartó entero.
 * Devuelve el acumulado y la parte del mes `mesVisible` (`YYYY-MM`).
 */
export function accrueFixedSince(input: {
  fijosMensual: number
  desde: string
  hasta: string
  mesVisible: string
}): { acumulado: number; mes: number } {
  if (input.fijosMensual <= 0 || input.hasta < input.desde) return { acumulado: 0, mes: 0 }

  let acumulado = 0
  let mes = 0
  const lastMonth = monthOf(input.hasta)
  for (let m = monthOf(input.desde); m <= lastMonth; m = shiftMonth(m, 1)) {
    const total = daysInMonth(`${m}-01`)
    const firstDay = m === monthOf(input.desde) ? dayOf(input.desde) : 1
    const lastDay = m === lastMonth ? dayOf(input.hasta) : total
    const days = lastDay - firstDay + 1
    if (days <= 0) continue
    const apartado = Math.round((input.fijosMensual * days) / total)
    acumulado += apartado
    if (m === input.mesVisible) mes = apartado
  }
  return { acumulado, mes }
}
