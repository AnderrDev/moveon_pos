import type { RegisterEntryFormValue } from './register-entry-form.factory'

export const registerEntryFormMapper = {
  /** Arranca con el costo vigente del producto para no tener que reescribirlo. */
  toFormValue(product: { costo?: number | null } | null): RegisterEntryFormValue {
    return { cantidad: 1, ubicacion: 'bodega', costoUnitario: product?.costo ?? 0, motivo: '', metodoPago: '' }
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
