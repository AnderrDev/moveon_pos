import { err, ok, type Result } from '@/shared/result'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { splitProductSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { InventoryValidationError } from '@angular-app/features/inventory/domain/usecases/register-entry.use-case'

export interface SplitProductDeps {
  repo: Pick<InventoryRepository, 'splitProduct'>
  tiendaId: string
  createdBy: string
}

/**
 * Fraccionar (PLAN-113): abrir N unidades de un producto (un tarro) para sacar
 * M porciones de otro (sachets). No es compra ni gasto: el costo del origen se
 * reparte entre las porciones. Mismo contrato de errores que `registerEntry`.
 */
export async function splitProduct(
  deps: SplitProductDeps,
  input: unknown,
): Promise<Result<InventoryMovement, InventoryValidationError>> {
  const parsed = splitProductSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del fraccionamiento inválidos',
    })
  }
  const movement = await deps.repo.splitProduct({
    tiendaId: deps.tiendaId,
    origenId: parsed.data.origenId,
    cantidadOrigen: parsed.data.cantidadOrigen,
    destinoId: parsed.data.destinoId,
    cantidadDestino: parsed.data.cantidadDestino,
    ubicacion: parsed.data.ubicacion,
    nota: parsed.data.nota,
    createdBy: deps.createdBy,
  })
  return ok(movement)
}
