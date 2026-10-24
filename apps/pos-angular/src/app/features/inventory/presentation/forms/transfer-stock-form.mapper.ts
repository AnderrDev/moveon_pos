import type { TransferStockFormValue } from './transfer-stock-form.factory'

export const transferStockFormMapper = {
  toPayload(value: TransferStockFormValue, productId: string) {
    return {
      productId,
      fromUbicacion: value.fromUbicacion,
      toUbicacion: value.toUbicacion,
      cantidad: value.cantidad,
      motivo: value.motivo,
    }
  },
}
