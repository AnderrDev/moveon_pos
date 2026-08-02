import { err, ok, type Result } from '@/shared/result'
import type { ExpenseTemplate } from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { saveTemplateSchema } from '@angular-app/features/expenses/domain/dtos/template.dto'
import type { ExpenseValidationError } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'

export interface SaveTemplateDeps {
  repo: Pick<ExpenseRepository, 'saveTemplate'>
}

/**
 * Valida y crea/actualiza una plantilla de gasto recurrente. Mismo patrón
 * que `registerExpense`: errores de forma como `Result`, fallos técnicos
 * como `throw`.
 */
export async function saveTemplate(
  deps: SaveTemplateDeps,
  input: unknown,
): Promise<Result<ExpenseTemplate, ExpenseValidationError>> {
  const parsed = saveTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de la plantilla inválidos',
    })
  }
  const template = await deps.repo.saveTemplate(parsed.data)
  return ok(template)
}
