import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

export interface ClienteInput {
  nombre: string
  tipoDocumento?: string
  numeroDocumento?: string
  email?: string
  telefono?: string
  autorizaFidelizacion?: boolean
  aceptaMensajesPromocionales?: boolean
}

/**
 * Contrato de persistencia de clientes. Abstract class (ADR 0015 §6.1).
 * No existía interfaz previa — creado desde el uso real de
 * `CustomersRepository` (2026-07-17).
 */
export abstract class CustomerRepository {
  abstract list(tiendaId: string): Promise<Cliente[]>
  /** Búsqueda flexible: celular normalizado O número de documento (RN-CL04). */
  abstract findByPhoneOrDocument(tiendaId: string, query: string): Promise<Cliente | null>
  abstract create(tiendaId: string, input: ClienteInput): Promise<Cliente>
  abstract update(id: string, tiendaId: string, input: ClienteInput): Promise<Cliente>
  abstract delete(id: string, tiendaId: string): Promise<void>
}
