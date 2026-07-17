import type { TiendaId } from '@/shared/types'

export interface Cliente {
  id: string
  tiendaId: TiendaId
  tipoDocumento: string | null
  numeroDocumento: string | null
  nombre: string
  email: string | null
  telefono: string | null
  /** Celular colombiano canónico (10 dígitos). Identificador operativo principal (RN-CL04). */
  celularNormalizado: string | null
  activo: boolean
  /** MOVE ON Club: el cliente autorizó participar en el programa (RN-CL06). */
  autorizaFidelizacion: boolean
  aceptaMensajesPromocionales: boolean
  createdAt: Date
  updatedAt: Date
}
