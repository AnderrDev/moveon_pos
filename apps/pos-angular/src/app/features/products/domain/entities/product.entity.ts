import type { IvaRate, ProductType, TiendaId } from '@/shared/types'

export interface Product {
  id: string
  tiendaId: TiendaId
  nombre: string
  sku: string | null
  codigoBarras: string | null
  categoriaId: string | null
  proveedorId: string | null
  /** Nombre del proveedor, resuelto vía join — solo lectura. */
  proveedorNombre: string | null
  paraQueSirve: string | null
  recomendadoPara: string | null
  imageUrl: string | null
  tipo: ProductType
  unidad: string
  precioVenta: number
  costo: number | null
  ivaTasa: IvaRate
  stockMinimo: number
  /** MOVE ON Club: genera sellos y puede canjearse como recompensa (RN-LF06). */
  participaFidelizacion: boolean
  isActive: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Categoria {
  id: string
  tiendaId: TiendaId
  nombre: string
  orden: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Proveedor {
  id: string
  tiendaId: TiendaId
  nombre: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
