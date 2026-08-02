import { err, ok, type Result } from '@/shared/result'
import type { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { transferStockSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { InventoryValidationError } from '@angular-app/features/inventory/domain/usecases/register-entry.use-case'

export interface TransferStockDeps {
  repo: Pick<InventoryRepository, 'transferStock'>
  tiendaId: string
  createdBy: string
}

/**
 * Valida y traslada stock entre ubicaciones. Mismo contrato de errores que
 * `registerEntry`. Devuelve el id del movimiento creado (ver
 * `InventoryRepository.transferStock`).
 */
export async function transferStock(
  deps: TransferStockDeps,
  input: unknown,
): Promise<Result<string, InventoryValidationError>> {
  const parsed = transferStockSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de traslado inválidos',
    })
  }
  const movementId = await deps.repo.transferStock({
    tiendaId: deps.tiendaId,
    productId: parsed.data.productId,
    fromUbicacion: parsed.data.fromUbicacion,
    toUbicacion: parsed.data.toUbicacion,
    cantidad: parsed.data.cantidad,
    motivo: parsed.data.motivo,
    createdBy: deps.createdBy,
  })
  return ok(movementId)
}
