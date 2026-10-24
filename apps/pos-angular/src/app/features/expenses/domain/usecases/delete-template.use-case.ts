import { err, ok, type Result } from '@/shared/result'
import { entityRefSchema } from '@/shared/validations/common'
import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import type { ExpenseValidationError } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'

export interface DeleteTemplateDeps {
  repo: Pick<ExpenseRepository, 'deleteTemplate'>
}

/**
 * Elimina una plantilla de gasto recurrente (configuración, no registro transaccional: borrado físico permitido).
 * Valida los ids con Zod (`entityRefSchema`) y devuelve `Result`; los fallos
 * técnicos del repositorio se propagan como `throw`.
 */
export async function deleteTemplate(
  deps: DeleteTemplateDeps,
  templateId: string,
  tiendaId: string,
): Promise<Result<void, ExpenseValidationError>> {
  const parsed = entityRefSchema.safeParse({ id: templateId, tiendaId })
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  await deps.repo.deleteTemplate(parsed.data.id, parsed.data.tiendaId)
  return ok(undefined)
}
