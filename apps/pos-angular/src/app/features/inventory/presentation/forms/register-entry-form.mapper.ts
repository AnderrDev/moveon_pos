import type { RegisterEntryFormValue } from './register-entry-form.factory'

export const registerEntryFormMapper = {
  /** Arranca con el costo vigente del producto para no tener que reescribirlo. */
  toFormValue(product: { costo?: number | null } | null): RegisterEntryFormValue {
    // Punto de venta por defecto: así se registran casi todas las entradas (88% en producción).
    return { cantidad: 1, ubicacion: 'punto_venta', costoUnitario: product?.costo ?? 0, motivo: '', metodoPago: '' }
  },

  toPayload(value: RegisterEntryFormValue, productId: string) {
    return {
      productId,
      cantidad: value.cantidad,
      ubicacion: value.ubicacion,
      costoUnitario: value.costoUnitario > 0 ? value.costoUnitario : undefined,
      motivo: value.motivo || undefined,
      metodoPago: value.metodoPago || undefined,
    }
  },
}
