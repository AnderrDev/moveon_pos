import type { MoneyEnvelopes } from '@angular-app/features/expenses/domain/services/money-envelopes'

/**
 * Consejos del asistente de finanzas (ADR 0025 §2). Dominio puro: devuelve
 * consejos TIPADOS (código + cifras); las frases las pone la presentación.
 * Nada aquí cambia el tamaño de los sobres — solo dice qué hacer con ellos.
 */

export const DEFAULT_INVENTORY_TARGET_DAYS = 45

export type InventoryLevel = 'verde' | 'ambar' | 'rojo' | 'sin_datos'

export interface InventoryCoverage {
  nivel: InventoryLevel
  /** Días de venta que cubre el inventario al costo; `null` sin ventas recientes. */
  dias: number | null
  metaDias: number
  inventarioAlCosto: number | null
  /** Costo de lo vendido por día (últimos 28 días). */
  cogsDiario: number
}

export type FinanceAdvice =
  | { code: 'comprar'; disponible: number }
  | { code: 'comprar_exceso'; exceso: number }
  | { code: 'retirar'; disponible: number }
  | { code: 'retirar_exceso'; exceso: number }
  | { code: 'guardar_fijos'; apartado: number; pagado: number; disponible: number }
  | { code: 'sin_fijos' }
  | { code: 'ventas_sin_costo'; lineas: number }
  | { code: 'entradas_sin_costo'; entradas: number }
  | { code: 'sin_retiros'; disponible: number }

export interface FinanceAdviceInput {
  envelopes: MoneyEnvelopes
  /** Σ stock × costo de los productos activos con stock; `null` si no cargó. */
  inventarioAlCosto: number | null
  cogsUltimos28Dias: number
  metaDias?: number
  /** Hay fijos configurados (plantillas activas o empleados con salario). */
  fijosConfigurados: boolean
  /** Hay al menos un retiro registrado desde el inicio. */
  hayRetiros: boolean
}

export interface FinanceAdviceResult {
  consejos: FinanceAdvice[]
  inventario: InventoryCoverage
}

export function inventoryCoverage(input: {
  inventarioAlCosto: number | null
  cogsUltimos28Dias: number
  metaDias: number
}): InventoryCoverage {
  const cogsDiario = input.cogsUltimos28Dias / 28
  if (input.inventarioAlCosto === null || cogsDiario <= 0) {
    return {
      nivel: 'sin_datos',
      dias: null,
      metaDias: input.metaDias,
      inventarioAlCosto: input.inventarioAlCosto,
      cogsDiario,
    }
  }
  const dias = Math.round(input.inventarioAlCosto / cogsDiario)
  const nivel: InventoryLevel =
    dias <= input.metaDias ? 'verde' : dias <= input.metaDias * 1.5 ? 'ambar' : 'rojo'
  return { nivel, dias, metaDias: input.metaDias, inventarioAlCosto: input.inventarioAlCosto, cogsDiario }
}

export function buildFinanceAdvice(input: FinanceAdviceInput): FinanceAdviceResult {
  const { mercancia, fijos, utilidad } = input.envelopes.sobres
  const consejos: FinanceAdvice[] = []

  if (mercancia.disponible >= 0) consejos.push({ code: 'comprar', disponible: mercancia.disponible })
  else consejos.push({ code: 'comprar_exceso', exceso: -mercancia.disponible })

  if (utilidad.disponible >= 0) consejos.push({ code: 'retirar', disponible: utilidad.disponible })
  else consejos.push({ code: 'retirar_exceso', exceso: -utilidad.disponible })

  if (input.fijosConfigurados) {
    consejos.push({
      code: 'guardar_fijos',
      apartado: fijos.apartadoAcumulado + fijos.saldoInicial,
      pagado: fijos.usadoAcumulado,
      disponible: fijos.disponible,
    })
  } else {
    consejos.push({ code: 'sin_fijos' })
  }

  if (input.envelopes.ventasSinCosto > 0) {
    consejos.push({ code: 'ventas_sin_costo', lineas: input.envelopes.ventasSinCosto })
  }
  if (input.envelopes.entradasSinCosto > 0) {
    consejos.push({ code: 'entradas_sin_costo', entradas: input.envelopes.entradasSinCosto })
  }
  if (!input.hayRetiros && utilidad.disponible > 0) {
    consejos.push({ code: 'sin_retiros', disponible: utilidad.disponible })
  }

  return {
    consejos,
    inventario: inventoryCoverage({
      inventarioAlCosto: input.inventarioAlCosto,
      cogsUltimos28Dias: input.cogsUltimos28Dias,
      metaDias: input.metaDias ?? DEFAULT_INVENTORY_TARGET_DAYS,
    }),
  }
}
