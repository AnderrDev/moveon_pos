import type { TiendaId } from '@/shared/types'

export interface Cliente {
  id: string
  tiendaId: TiendaId
  tipoDocumento: string | null
  numeroDocumento: string | null
  nombre: string
  email: string | null
  telefono: string | null
  createdAt: Date
  updatedAt: Date
}
