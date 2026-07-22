import { err, ok, type Result } from '@/shared/result'
import type { ReinvestmentFundSettings } from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { saveFundSettingsSchema } from '@angular-app/features/expenses/domain/dtos/fund-settings.dto'
import type { ExpenseValidationError } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'

export interface SaveFundSettingsDeps {
  repo: Pick<ExpenseRepository, 'saveFundSettings'>
}

/**
 * Valida y guarda la configuración del fondo de reinversión. Mismo patrón
 * que `registerExpense`: errores de forma como `Result`, fallos técnicos
 * como `throw`.
 */
export async function saveFundSettings(
  deps: SaveFundSettingsDeps,
  input: unknown,
): Promise<Result<ReinvestmentFundSettings, ExpenseValidationError>> {
  const parsed = saveFundSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del fondo inválidos',
    })
  }
  const settings = await deps.repo.saveFundSettings(parsed.data)
  return ok(settings)
}
