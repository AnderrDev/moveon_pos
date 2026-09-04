import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import type { ClienteInput } from '@angular-app/features/customers/domain/repositories/customer.repository'
import type { ClienteFormValue } from '@angular-app/features/customers/presentation/forms/cliente-form.factory'

/**
 * Traduce entre la entidad de dominio y los valores del formulario, y entre
 * los valores del formulario y el payload de escritura. TypeScript puro.
 */
export const clienteFormMapper = {
  /** Entidad de dominio → valores iniciales del formulario (modo edición). */
  toFormValue(cliente?: Cliente | null): ClienteFormValue {
    return {
      nombre: cliente?.nombre ?? '',
      tipoDocumento: cliente?.tipoDocumento ?? '',
      numeroDocumento: cliente?.numeroDocumento ?? '',
      email: cliente?.email ?? '',
      telefono: cliente?.telefono ?? '',
      autorizaFidelizacion: cliente?.autorizaFidelizacion ?? true,
      aceptaMensajesPromocionales: cliente?.aceptaMensajesPromocionales ?? true,
    }
  },

  /** Valores del formulario → payload de creación/actualización (mismo shape). */
  toPayload(value: ClienteFormValue): ClienteInput {
    return {
      nombre: value.nombre.trim(),
      tipoDocumento: value.tipoDocumento.trim(),
      numeroDocumento: value.numeroDocumento.trim(),
      email: value.email?.trim() || undefined,
      telefono: value.telefono.trim() || undefined,
      autorizaFidelizacion: value.autorizaFidelizacion,
      aceptaMensajesPromocionales: value.aceptaMensajesPromocionales,
    }
  },
}
