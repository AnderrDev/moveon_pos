import { err, ok, type Result } from '@/shared/result'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import type { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import { clienteInputSchema } from '@angular-app/features/customers/domain/dtos/cliente.dto'
import type { CustomerValidationError } from '@angular-app/features/customers/domain/usecases/create-customer.use-case'

export interface UpdateCustomerDeps {
  repo: Pick<CustomerRepository, 'update'>
  tiendaId: string
}

/** Valida y actualiza un cliente. Mismo contrato de errores que `createCustomer`. */
export async function updateCustomer(
  deps: UpdateCustomerDeps,
  clienteId: string,
  input: unknown,
): Promise<Result<Cliente, CustomerValidationError>> {
  const parsed = clienteInputSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del cliente inválidos',
    })
  }
  const cliente = await deps.repo.update(clienteId, deps.tiendaId, parsed.data)
  return ok(cliente)
}
