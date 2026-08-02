import { err, ok, type Result } from '@/shared/result'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { registerEntrySchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'

export interface RegisterEntryDeps {
  repo: Pick<InventoryRepository, 'registerEntry'>
  tiendaId: string
  createdBy: string
}

export interface InventoryValidationError {
  code: 'validation'
  message: string
}

/**
 * Valida y registra una entrada de inventario. Errores de dominio como
 * `Result`; los fallos técnicos del repositorio se propagan como `throw`
 * (mismo patrón que createCustomer/createProduct).
 */
export async function registerEntry(
  deps: RegisterEntryDeps,
  input: unknown,
): Promise<Result<InventoryMovement, InventoryValidationError>> {
  const parsed = registerEntrySchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de entrada inválidos',
    })
  }
  const movement = await deps.repo.registerEntry({
    tiendaId: deps.tiendaId,
    productId: parsed.data.productId,
    cantidad: parsed.data.cantidad,
    ubicacion: parsed.data.ubicacion,
    costoUnitario: parsed.data.costoUnitario,
    motivo: parsed.data.motivo,
    createdBy: deps.createdBy,
  })
  return ok(movement)
}
