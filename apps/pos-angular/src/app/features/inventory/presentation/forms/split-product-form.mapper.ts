import type { SplitProductDto } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { SplitProductFormValue } from './split-product-form.factory'

export const splitProductFormMapper = {
  toPayload(value: SplitProductFormValue, origenId: string): SplitProductDto {
    return {
      origenId,
      cantidadOrigen: value.cantidadOrigen,
      destinoId: value.destinoId,
      cantidadDestino: value.cantidadDestino,
      ubicacion: value.ubicacion,
      nota: value.nota.trim() || undefined,
    }
  },
}
