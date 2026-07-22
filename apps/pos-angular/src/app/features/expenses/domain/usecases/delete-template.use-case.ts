import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'

export interface DeleteTemplateDeps {
  repo: Pick<ExpenseRepository, 'deleteTemplate'>
}

/**
 * Elimina una plantilla de gasto recurrente. Sin validación de forma (solo
 * IDs) — las plantillas son configuración, no registros transaccionales
 * (borrado físico permitido). Los fallos se propagan como `throw`.
 */
export function deleteTemplate(deps: DeleteTemplateDeps, templateId: string, tiendaId: string): Promise<void> {
  return deps.repo.deleteTemplate(templateId, tiendaId)
}
