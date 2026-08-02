/**
 * Fondo de reinversión de mercancía: el costo de lo vendido no es gasto ni
 * utilidad — es dinero que debe volver a convertirse en mercancía. Cada venta
 * "aparta" el costo de lo vendido (aporta al fondo) y cada entrada de
 * inventario con costo (surtir) lo consume. Función pura — la página la
 * alimenta con los totales de la RPC `get_reinvestment_fund_totals`.
 *
 *   Disponible = saldo inicial + apartado acumulado − invertido acumulado
 */

/** Totales agregados desde la fecha de inicio del fondo (los devuelve la RPC). */
export interface ReinvestmentFundTotals {
  /** Σ costo de productos vendidos (ventas completadas). */
  cogsAcumulado: number
  /** Σ compras de mercancía (entradas de inventario con costo). */
  comprasAcumuladas: number
  cogsMes: number
  comprasMes: number
  /** Líneas de venta cuyo producto no tiene costo capturado. */
  ventasSinCosto: number
  /** Entradas de inventario sin costo capturado — no descuentan del fondo. */
  entradasSinCosto: number
}

export interface ReinvestmentFundInput extends ReinvestmentFundTotals {
  saldoInicial: number
}

export interface ReinvestmentFund {
  saldoInicial: number
  apartadoAcumulado: number
  invertidoAcumulado: number
  /** Dinero disponible hoy para comprar mercancía. */
  disponible: number
  apartadoMes: number
  invertidoMes: number
  ventasSinCosto: number
  entradasSinCosto: number
}

export function buildReinvestmentFund(input: ReinvestmentFundInput): ReinvestmentFund {
  return {
    saldoInicial: input.saldoInicial,
    apartadoAcumulado: input.cogsAcumulado,
    invertidoAcumulado: input.comprasAcumuladas,
    disponible: input.saldoInicial + input.cogsAcumulado - input.comprasAcumuladas,
    apartadoMes: input.cogsMes,
    invertidoMes: input.comprasMes,
    ventasSinCosto: input.ventasSinCosto,
    entradasSinCosto: input.entradasSinCosto,
  }
}
