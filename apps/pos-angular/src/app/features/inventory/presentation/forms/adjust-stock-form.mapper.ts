import type { AdjustStockFormValue } from './adjust-stock-form.factory'

export const adjustStockFormMapper = {
  toPayload(value: AdjustStockFormValue, productId: string) {
    return { productId, cantidadDelta: value.cantidadDelta, ubicacion: value.ubicacion, motivo: value.motivo }
  },
}
