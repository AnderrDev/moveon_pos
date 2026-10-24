import { err, ok, type Result } from '@/shared/result'
import { entityRefSchema } from '@/shared/validations/common'
import type { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import type { CustomerValidationError } from '@angular-app/features/customers/domain/usecases/create-customer.use-case'

export interface DeleteCustomerDeps {
  repo: Pick<CustomerRepository, 'delete'>
}

/**
 * Elimina un cliente (borrado lógico en la RPC: conserva ventas y fidelización).
 * Valida los ids con Zod (`entityRefSchema`) y devuelve `Result`; los fallos
 * técnicos del repositorio se propagan como `throw`.
 */
export async function deleteCustomer(
  deps: DeleteCustomerDeps,
  clienteId: string,
  tiendaId: string,
): Promise<Result<void, CustomerValidationError>> {
  const parsed = entityRefSchema.safeParse({ id: clienteId, tiendaId })
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  await deps.repo.delete(parsed.data.id, parsed.data.tiendaId)
  return ok(undefined)
}
