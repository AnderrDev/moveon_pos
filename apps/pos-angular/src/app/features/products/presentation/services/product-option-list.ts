import type { ProductOption } from '@angular-app/features/products/domain/repositories/product.repository'

/** Datos capturados en la fila "Agregar opción" del editor de opciones (ADR 0017). */
export interface PendingProductOption {
  grupo: string
  nombre: string
  precioExtra: number
  componenteId: string | null
  componenteNombre: string
  componenteCantidad: number
}

export type AddOptionResult =
  | { ok: true; options: ProductOption[] }
  | { ok: false; error: string }

/**
 * Agrega una opción a la lista. Rechaza nombres repetidos (sin distinguir
 * mayúsculas); la primera opción que se crea queda como predeterminada.
 */
export function addProductOption(options: ProductOption[], pending: PendingProductOption): AddOptionResult {
  const nombre = pending.nombre.trim()
  if (!nombre) return { ok: false, error: 'Escribe el nombre de la opción' }
  if (options.some((o) => o.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { ok: false, error: 'Ya existe una opción con ese nombre' }
  }

  const componenteId = pending.componenteId || null
  return {
    ok: true,
    options: [
      ...options,
      {
        grupo: pending.grupo.trim() || 'Proteína',
        nombre,
        precioExtra: Math.max(0, Math.round(pending.precioExtra)),
        componenteId,
        componenteNombre: componenteId ? pending.componenteNombre : '',
        componenteCantidad: componenteId ? Math.max(0, pending.componenteCantidad) : 0,
        esDefault: options.length === 0,
      },
    ],
  }
}

/** Quita una opción; si era la predeterminada, la primera que quede toma el relevo. */
export function removeProductOption(options: ProductOption[], nombre: string): ProductOption[] {
  const next = options.filter((o) => o.nombre !== nombre)
  if (next.length > 0 && !next.some((o) => o.esDefault)) {
    return next.map((o, index) => ({ ...o, esDefault: index === 0 }))
  }
  return next
}

export function setDefaultProductOption(options: ProductOption[], nombre: string): ProductOption[] {
  return options.map((o) => ({ ...o, esDefault: o.nombre === nombre }))
}
