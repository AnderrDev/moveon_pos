import { err, ok, type Result } from '@/shared/result'
import { correctEntryCostSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import type { InventoryValidationError } from '@angular-app/features/inventory/domain/usecases/register-entry.use-case'

export interface CorrectEntryCostDeps {
  repo: Pick<InventoryRepository, 'correctEntryCost'>
  tiendaId: string
  correctedBy: string
}

/**
 * Corrige únicamente el costo financiero de una entrada. La RPC conserva la
 * cantidad y ubicación, vuelve a validar permisos y registra old/new/reason.
 */
export async function correctEntryCost(
  deps: CorrectEntryCostDeps,
  input: unknown
): Promise<Result<InventoryMovement, InventoryValidationError>> {
  const parsed = correctEntryCostSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de corrección inválidos',
    })
  }

  const movement = await deps.repo.correctEntryCost({
    movementId: parsed.data.movementId,
    tiendaId: deps.tiendaId,
    newCost: parsed.data.newCost,
    updateProductCost: parsed.data.updateProductCost,
    correctedBy: deps.correctedBy,
    reason: parsed.data.reason,
  })
  return ok(movement)
}
