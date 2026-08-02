import { err, ok, type Result } from '@/shared/result'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { adjustStockSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { InventoryValidationError } from '@angular-app/features/inventory/domain/usecases/register-entry.use-case'

export interface AdjustStockDeps {
  repo: Pick<InventoryRepository, 'adjustStock'>
  tiendaId: string
  createdBy: string
}

/** Valida y registra un ajuste de stock. Mismo contrato de errores que `registerEntry`. */
export async function adjustStock(
  deps: AdjustStockDeps,
  input: unknown,
): Promise<Result<InventoryMovement, InventoryValidationError>> {
  const parsed = adjustStockSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de ajuste inválidos',
    })
  }
  const movement = await deps.repo.adjustStock({
    tiendaId: deps.tiendaId,
    productId: parsed.data.productId,
    cantidadDelta: parsed.data.cantidadDelta,
    ubicacion: parsed.data.ubicacion,
    motivo: parsed.data.motivo,
    createdBy: deps.createdBy,
  })
  return ok(movement)
}
