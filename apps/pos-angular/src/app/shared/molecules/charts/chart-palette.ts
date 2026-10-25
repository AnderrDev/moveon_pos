/**
 * Colores de las gráficas (decisión del dueño, 2026-10-24): una paleta aparte
 * de la marca, solo dentro de las gráficas. El amarillo y el negro de la marca
 * no pasan las pruebas de lectura para barras sobre fondo claro.
 *
 * Validados con la guía de visualización (`validate_palette.js --mode light`):
 * banda de luminosidad, croma, separación para daltonismo (ΔE ≥ 9) y
 * contraste. Orden fijo: la serie 1 siempre es azul, nunca se recicla.
 * El verde queda bajo 3:1 de contraste → va siempre con etiqueta o tabla.
 */
export const CHART_SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const

/** Serie de una sola variable (ventas, unidades...). */
export const CHART_PRIMARY = CHART_SERIES[0]

export type ChartFormat = 'money' | 'count'

/** Un dato de una serie: `label` es lo que se lee en el eje o la fila. */
export interface ChartPoint {
  key: string
  label: string
  value: number
  /** Línea secundaria del tooltip y de la tabla (p. ej. "12 ventas"). */
  detail?: string
}
