import type { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'

export interface DeleteCustomerDeps {
  repo: Pick<CustomerRepository, 'delete'>
}

/**
 * Elimina un cliente. Sin validación de forma (solo IDs) — existe como seam
 * estable para reglas futuras (ej. bloquear si tiene historial de
 * fidelización) sin tocar el llamador. Los fallos se propagan como `throw`.
 */
export function deleteCustomer(deps: DeleteCustomerDeps, clienteId: string, tiendaId: string): Promise<void> {
  return deps.repo.delete(clienteId, tiendaId)
}
