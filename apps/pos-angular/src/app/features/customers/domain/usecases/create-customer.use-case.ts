import { err, ok, type Result } from '@/shared/result'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import type { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import { clienteInputSchema } from '@angular-app/features/customers/domain/dtos/cliente.dto'

export interface CreateCustomerDeps {
  repo: Pick<CustomerRepository, 'create'>
  tiendaId: string
}

export interface CustomerValidationError {
  code: 'validation'
  message: string
}

/**
 * Valida y crea un cliente. Errores de dominio como `Result`; los fallos
 * técnicos del repositorio (red, DB, celular/documento duplicado) se
 * propagan como `throw` — mismo patrón que `registerExpense`.
 */
export async function createCustomer(
  deps: CreateCustomerDeps,
  input: unknown,
): Promise<Result<Cliente, CustomerValidationError>> {
  const parsed = clienteInputSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del cliente inválidos',
    })
  }
  const cliente = await deps.repo.create(deps.tiendaId, parsed.data)
  return ok(cliente)
}
