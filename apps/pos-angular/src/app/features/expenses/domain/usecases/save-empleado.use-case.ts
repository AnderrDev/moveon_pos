import { err, ok, type Result } from '@/shared/result'
import type { Empleado } from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { saveEmpleadoSchema } from '@angular-app/features/expenses/domain/dtos/empleado.dto'
import type { ExpenseValidationError } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'

export interface SaveEmpleadoDeps {
  repo: Pick<ExpenseRepository, 'saveEmpleado'>
}

/**
 * Valida y crea/actualiza un empleado (nómina simulada). Mismo patrón que
 * `registerExpense`: errores de forma como `Result`, fallos técnicos como `throw`.
 */
export async function saveEmpleado(
  deps: SaveEmpleadoDeps,
  input: unknown,
): Promise<Result<Empleado, ExpenseValidationError>> {
  const parsed = saveEmpleadoSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del empleado inválidos',
    })
  }
  const empleado = await deps.repo.saveEmpleado(parsed.data)
  return ok(empleado)
}
